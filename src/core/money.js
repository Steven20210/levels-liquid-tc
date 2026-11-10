// Parsing and formatting of levels.fyi money values ("$47.4K", "$313,920"). Pure.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  const NUM = '(\\d[\\d,]*(?:\\.\\d+)?)';
  const MONEY_RE = new RegExp(NUM + '\\s*([KkMm](?![a-z]))?');
  const MONEY_RE_G = new RegExp(NUM + '\\s*([KkMm](?![a-z]))?', 'g');

  function toNumber(digits, suffix) {
    let n = parseFloat(String(digits).replace(/,/g, ''));
    if (!isFinite(n)) return null;
    const s = (suffix || '').toUpperCase();
    if (s === 'K') n *= 1e3;
    else if (s === 'M') n *= 1e6;
    return n;
  }

  /** "$47.4K" -> 47400, "$313,920" -> 313920, "--" -> null */
  function parseMoney(str) {
    if (str == null) return null;
    const m = String(str).match(MONEY_RE);
    return m ? toNumber(m[1], m[2]) : null;
  }

  /** All money-looking values in a string, in order. */
  function parseAllMoney(str) {
    const out = [];
    if (str == null) return out;
    for (const m of String(str).matchAll(MONEY_RE_G)) {
      const n = toNumber(m[1], m[2]);
      if (n != null) out.push(n);
    }
    return out;
  }

  /** Remember how the original value was written so the replacement looks native. */
  function describeFormat(str) {
    const m = String(str).match(/^(\s*)(\D*?)(\d[\d,]*(?:\.\d+)?)(\s*)([KkMm](?![a-z]))?([\s\S]*)$/);
    if (!m) return null;
    return {
      lead: m[1],
      prefix: m[2],
      commas: m[3].includes(','),
      space: m[4],
      suffix: m[5] || '',
      rest: m[6],
    };
  }

  function formatMoney(value, fmt) {
    fmt = fmt || { lead: '', prefix: '$', commas: true, space: '', suffix: '', rest: '' };
    let suffix = fmt.suffix;
    let body;
    if (suffix) {
      let up = suffix.toUpperCase();
      let v = value / (up === 'K' ? 1e3 : 1e6);
      if (up === 'K' && Math.abs(v) >= 999.5) {
        v = value / 1e6;
        up = 'M';
        suffix = suffix === 'k' ? 'm' : 'M';
      }
      const a = Math.abs(v);
      const digits = a >= 100 ? 0 : a >= 10 ? 1 : up === 'M' ? 2 : 1;
      body = String(Number(v.toFixed(digits)));
    } else {
      const r = Math.round(value);
      body = fmt.commas ? r.toLocaleString('en-US') : String(r);
    }
    return fmt.lead + fmt.prefix + body + fmt.space + suffix + fmt.rest;
  }

  /**
   * Find annual stock inside a combined TC cell, e.g.
   * "$313,920\n$180K | $90K | $20K" with order ['base','stock','bonus'].
   */
  function stockFromBreakdown(text, order) {
    order = order && order.length ? order : ['base', 'stock', 'bonus'];
    const idx = order.indexOf('stock');
    if (idx < 0) return null;
    // Flatten: the separators may be in their own elements / lines ("$125K\n|\n$32.5K\n|\n--").
    const flat = String(text).replace(/\s+/g, ' ');
    const first = flat.match(MONEY_RE); // headline total comes first
    const after = first ? flat.slice(first.index + first[0].length) : flat;
    if (after.includes('|')) {
      const parts = after.split('|');
      if (parts.length >= order.length) {
        const v = parseMoney(parts[idx]);
        return v == null ? 0 : v; // "--" / "N/A" = none
      }
    }
    // No separators: money values and "--"/"N/A" placeholders, in column order.
    const tokens = [...after.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*([KkMm](?![a-z]))?|(?:--|—|–|N\/A)/gi)];
    if (tokens.length >= order.length) {
      const t = tokens[idx];
      return t[1] ? toNumber(t[1], t[2]) : 0;
    }
    return null;
  }

  const api = { parseMoney, parseAllMoney, describeFormat, formatMoney, stockFromBreakdown };
  if (isNode) module.exports = api;
  else root.LCTC = Object.assign(root.LCTC || {}, api);
})(typeof self !== 'undefined' ? self : this);
