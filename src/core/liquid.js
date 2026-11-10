// Liquid-TC math, the private-with-tenders list lookup, and the tender block model. Pure.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const { normalizeName, nameVariants } = isNode ? require('./names.js') : root.LCTC;
  const { describeFormat, formatMoney } = isNode ? require('./money.js') : root.LCTC;

  /**
   * Liquid TC. Public: unchanged (stock can be sold). Private / liquid (private with regular
   * tenders): stock counted at pct% — the caller passes the slider for that type.
   */
  function liquidTotal(total, stock, type, pct) {
    if (type !== 'private' && type !== 'liquid') return total;
    const s = stock || 0;
    return Math.max(0, total - s * (1 - pct / 100));
  }

  // Private companies with regular employee liquidity (liquidity.js), normalized like aliases.
  const RAW_LIQUID =
    typeof module !== 'undefined' && module.exports ? require('../data/liquidity.js') : root.LCTC_LIQUID || {};
  const LIQUID = {};
  for (const [name, entry] of Object.entries(RAW_LIQUID)) {
    const n = normalizeName(name.replace(/-/g, ' '));
    if (!n) continue;
    LIQUID[n] = entry;
    LIQUID[n.replace(/ /g, '')] = entry;
  }

  /** { tier, note, sources } if a candidate name is on the liquid-private list, else null. */
  function matchLiquid(candidates) {
    for (const cand of candidates) {
      for (const variant of nameVariants(cand)) {
        const n = normalizeName(variant);
        if (!n) continue;
        for (const k of [n, n.replace(/ /g, '')]) {
          if (Object.prototype.hasOwnProperty.call(LIQUID, k)) return LIQUID[k];
        }
      }
    }
    return null;
  }

  /**
   * Text for the footer shown under an expanded salary entry. Pure, so it can be unit-tested.
   * info: { type: 'public'|'private'|'liquid', reason, orig, liquid, stock, pct, evidence? }
   * evidence (liquid list only): { note, tierLabel, sources[] }.
   */
  function footerModel(info) {
    // Show amounts in the same style as the page ("$219K" vs "$313,920").
    const style = describeFormat(info.orig);
    const money = (v) => formatMoney(v, style && { ...style, lead: '', rest: '' });
    const counted = info.type === 'public' ? 100 : info.pct;
    const title =
      info.type === 'public'
        ? 'Public company: stock counted at 100%'
        : info.type === 'liquid'
          ? `Private, with regular tender offers: stock counted at ${counted}%`
          : `Private company: stock counted at ${counted}%`;
    const summary =
      `Liquid TC ${money(info.liquid)} (original ${String(info.orig).trim()}, ` +
      `stock ${money(info.stock || 0)}/yr counted at ${counted}%)`;
    const ev = info.evidence
      ? {
          note: info.evidence.note,
          tierLabel: info.evidence.tierLabel,
          sources: (info.evidence.sources || []).filter((u) => /^https:\/\//.test(u)),
        }
      : null;
    const why = ev ? '' : info.reason || '';
    return { type: info.type, title, summary, why, evidence: ev, sig: JSON.stringify([info.type, title, summary, why, ev]) };
  }

  const api = { liquidTotal, matchLiquid, footerModel };
  if (isNode) module.exports = api;
  else root.LCTC = Object.assign(root.LCTC || {}, api);
})(typeof self !== 'undefined' ? self : this);
