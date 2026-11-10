// Company status (public / private / liquid / unknown) and the SEC index loader.
(() => {
  'use strict';
  const L = self.LCTC;
  const U = L.ui;
  const S = U.state;

  // ---------- SEC index ----------

  async function loadSecIndex(force) {
    S.sec = { ...S.sec, state: 'loading' };
    try {
      const res = await chrome.runtime.sendMessage({ type: 'getSecIndex', force: !!force });
      if (!res || !res.ok) throw new Error(res ? res.error : 'no response from background');
      S.sec = { state: 'ready', index: res.index, error: res.error || null };
    } catch (e) {
      S.sec = { state: 'error', index: null, error: e.message };
    }
    U.scheduleProcess();
  }

  /** Public if the company (or its parent, via alias) is in the SEC's list of listed companies. */
  function statusFor(slug, name) {
    const ov = S.settings.overrides[slug];
    if (ov === 'public' || ov === 'private' || ov === 'liquid') return { type: ov, reason: 'your override' };
    if (S.sec.state === 'loading') return { type: 'unknown', reason: 'loading SEC company list…' };
    if (S.sec.state === 'error') return { type: 'unknown', reason: 'SEC list unavailable: ' + S.sec.error };

    // Listed companies win, so a liquid-list entry that has since IPO'd becomes public.
    const m = L.matchSec(S.sec.index, [name, slug]);
    const liquid = m ? null : L.matchLiquid([name, slug]);
    const TIER = { official: 'company announcement', confirmed: 'company-confirmed reports', press: 'press reports' };
    const tierLabel = liquid ? TIER[liquid.tier] || 'press reports' : '';
    const liquidNote = liquid && `${liquid.note} (source: ${tierLabel})`;
    const status = m
      ? {
          type: 'public',
          reason: `${m.ticker} on ${m.exchange}${m.otc ? ' (ADR of a foreign-listed company)' : ''} — ${m.title}` +
            ` (source: ${m.exchange === 'TSX' ? 'TMX/TSX company directory' : 'SEC EDGAR'})`,
        }
      : liquidNote
        ? {
            type: 'liquid',
            reason: `private, but employees can regularly sell shares: ${liquidNote}`,
            evidence: { note: liquid.note, tierLabel, sources: liquid.sources },
          }
        : { type: 'private', reason: 'not listed on a U.S. exchange (SEC EDGAR) or the Toronto Stock Exchange' };
    return status;
  }

  Object.assign(U, { loadSecIndex, statusFor });
})();
