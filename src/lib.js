// Pure helpers (no DOM / chrome APIs) so they can be unit-tested in Node.
(function (root) {
  'use strict';

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

  /** Liquid TC. Public: unchanged (stock can be sold). Private: illiquid stock counted at pct%. */
  function liquidTotal(total, stock, type, pct) {
    if (type !== 'private') return total;
    const s = stock || 0;
    return Math.max(0, total - s * (1 - pct / 100));
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

  // Brand -> ticker table lives in aliases.js. Keys are normalized here (and also indexed
  // with spaces removed) so the file can use natural names like "Whole Foods".
  const RAW_ALIASES =
    typeof module !== 'undefined' && module.exports ? require('./aliases.js') : root.LCTC_ALIASES || {};
  const ALIASES = {};
  for (const [brand, ticker] of Object.entries(RAW_ALIASES)) {
    const n = normalizeName(brand.replace(/-/g, ' '));
    if (!n) continue;
    ALIASES[n] = ticker;
    ALIASES[n.replace(/ /g, '')] = ticker;
  }

  const MAJOR_EXCHANGES = new Set(['nasdaq', 'nyse', 'cboe', 'txse', 'tsx']);

  /**
   * SEC company_tickers_exchange.json ({fields, data:[[cik,name,ticker,exchange]]})
   * -> { normalizedName: "TICKER|Registrant name|Exchange" }.
   * Tickers with no exchange (not currently trading) are skipped, and so are OTC tickers
   * unless they're ADRs of foreign-listed companies: OTC is full of small companies whose
   * names collide with startups (e.g. "Vanta Holdings" OTC vs. Vanta the startup). Each company is
   * indexed both as-is ("sirius xm") and with spaces removed ("siriusxm").
   * Major-exchange listings win over OTC ones when names collide.
   */
  function buildSecIndex(json, tsxJson) {
    const f = (json && json.fields) || [];
    const ci = (k) => f.indexOf(k);
    const [iName, iTicker, iExch] = [ci('name'), ci('ticker'), ci('exchange')];
    // When two listings normalize to the same name: US major exchange > TSX > OTC ADR.
    const rank = (e) => {
      const x = String(e).toLowerCase();
      return x === 'tsx' ? 2 : MAJOR_EXCHANGES.has(x) ? 3 : 1;
    };
    const map = {};
    const put = (key, ticker, name, exch) => {
      if (!key) return;
      const prev = map[key];
      if (prev && rank(prev.split('|')[2]) >= rank(exch)) return; // keep first / better listing
      map[key] = ticker + '|' + name + '|' + exch;
    };
    const add = (name, ticker, exch, tickerKey) => {
      const key = normalizeName(name);
      put(key, ticker, name, exch);
      put(key.replace(/ /g, ''), ticker, name, exch);
      put('$' + tickerKey, ticker, name, exch); // for aliases.js lookups
    };
    for (const row of (json && json.data) || []) {
      const exch = row[iExch];
      if (!exch) continue;
      if (!MAJOR_EXCHANGES.has(String(exch).toLowerCase()) && !/\bADR\b/i.test(row[iName])) continue;
      add(row[iName], row[iTicker], exch, row[iTicker]);
    }
    // Toronto Stock Exchange (TMX company directory). Aliases reference these as "TSX:SYMBOL".
    for (const r of (tsxJson && tsxJson.results) || []) {
      if (!r || !r.name || !r.symbol || TSX_FUND_RE.test(r.name)) continue;
      // Issuers whose only TSX listing is preferred shares / debentures (e.g. Power Financial) aren't
      // equity employers can pay in.
      if (/\.(PR|PF|DB)\b/.test(r.symbol)) continue;
      add(r.name, r.symbol, 'TSX', 'TSX:' + r.symbol);
    }
    return map;
  }

  // ETFs, mutual funds, pools, notes etc. listed on the TSX aren't employers.
  const TSX_FUND_RE = /\b(ETFs?|Funds?|Portfolios?|Index|Pool|Notes?|Bonds?|Split)\b/i;

  /** Split "SiriusXM + Pandora" / "Meta (Facebook)" into ["SiriusXM + Pandora", "SiriusXM", "Pandora", ...] */
  function nameVariants(cand) {
    const s = String(cand || '').replace(/-/g, ' ').trim();
    if (!s) return [];
    const parts = s.split(/\s*[+/|(),]\s*|\s+-\s+/).map((p) => p.trim()).filter(Boolean);
    return [s, ...parts.filter((p) => p !== s)];
  }

  /**
   * Try each candidate name (display name, slug) against the SEC index.
   * Returns { ticker, title, exchange, otc } or null.
   */
  function matchSec(index, candidates) {
    const hit = (entry) => {
      const [ticker, title, exchange] = entry.split('|');
      return { ticker, title, exchange, otc: !MAJOR_EXCHANGES.has(String(exchange).toLowerCase()) };
    };
    for (const cand of candidates) {
      for (const variant of nameVariants(cand)) {
        const n = normalizeName(variant);
        if (!n) continue;
        const squashed = n.replace(/ /g, '');
        // 1) Curated alias (aliases.js) wins. null = known private; a ticker that is no longer
        //    trading means the parent went private/delisted -> not public.
        for (const k of [n, squashed]) {
          if (Object.prototype.hasOwnProperty.call(ALIASES, k)) {
            const t = ALIASES[k];
            return t && index['$' + t] ? hit(index['$' + t]) : null;
          }
        }
        // 2) Direct name match. Needs 2+ chars so e.g. "X" alone can't hit "X Financial".
        for (const key of [n.length >= 2 ? n : null, squashed.length >= 3 ? squashed : null]) {
          if (key && index[key]) return hit(index[key]);
        }
      }
    }
    return null;
  }

  /** Alias table (normalized key -> ticker), exposed for the verification script. */
  function aliasTable() {
    return { ...ALIASES };
  }

  const api = {
    normalizeName,
    buildSecIndex,
    matchSec,
    aliasTable,
    parseMoney,
    parseAllMoney,
    describeFormat,
    formatMoney,
    liquidTotal,
    stockFromBreakdown,
    slugify,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LCTC = api;
})(typeof self !== 'undefined' ? self : this);
