// Company-name helpers: slugs, normalization and name variants. Pure (no DOM / chrome APIs).
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  function slugify(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // ---------- SEC EDGAR name matching ----------

  // Legal-form / filler words dropped from the END of names: "Uber Technologies, Inc." -> "uber".
  const SUFFIXES = new Set(
    ('inc incorporated corp corporation co company cos ltd limited plc llc lp sa nv ag se ab asa spa bv ' +
      'holdings holding group technologies technology the and de new financial global platforms markets us')
      .split(' ')
  );

  /** "JPMORGAN CHASE & CO" -> "jpmorgan chase", "Meta Platforms, Inc." -> "meta" */
  function normalizeName(name) {
    let s = String(name || '')
      .toLowerCase()
      .replace(/\s*\/\s*[a-z]{2,3}\s*\/?\s*$/, ' ') // "QUALCOMM INC/DE", "Rivian Automotive, Inc. / DE"
      .replace(/&/g, ' and ')
      .replace(/\.com\b/g, ' com')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    // Re-join initials: "s a" -> "sa", "n v" -> "nv", "j p morgan" -> "jp morgan"
    const words = s.replace(/\b[a-z](?: [a-z]\b)+/g, (m) => m.replace(/ /g, '')).split(' ');
    while (words.length > 1 && SUFFIXES.has(words[words.length - 1])) words.pop();
    if (words.length > 1 && words[0] === 'the') words.shift();
    return words.join(' ');
  }

  /** Split "SiriusXM + Pandora" / "Meta (Facebook)" into ["SiriusXM + Pandora", "SiriusXM", "Pandora", ...] */
  function nameVariants(cand) {
    const s = String(cand || '').replace(/-/g, ' ').trim();
    if (!s) return [];
    const parts = s.split(/\s*[+/|(),]\s*|\s+-\s+/).map((p) => p.trim()).filter(Boolean);
    return [s, ...parts.filter((p) => p !== s)];
  }

  const api = { slugify, normalizeName, nameVariants };
  if (isNode) module.exports = api;
  else root.LCTC = Object.assign(root.LCTC || {}, api);
})(typeof self !== 'undefined' ? self : this);
