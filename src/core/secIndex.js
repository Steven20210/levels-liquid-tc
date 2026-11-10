// Exchange-listed company index (SEC EDGAR + TSX) and name -> ticker matching. Pure.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const { normalizeName, nameVariants } = isNode ? require('./names.js') : root.LCTC;

  // Brand -> ticker table lives in aliases.js. Keys are normalized here (and also indexed
  // with spaces removed) so the file can use natural names like "Whole Foods".
  const RAW_ALIASES =
    typeof module !== 'undefined' && module.exports ? require('../data/aliases.js') : root.LCTC_ALIASES || {};
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
    const map = Object.create(null); // keys come from remote data: "constructor" must not hit Object.prototype
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
          // Own keys only: the index is a plain object again after chrome messaging / storage.
          if (key && Object.prototype.hasOwnProperty.call(index, key)) return hit(index[key]);
        }
      }
    }
    return null;
  }

  /** Alias table (normalized key -> ticker), exposed for the verification script. */
  function aliasTable() {
    return { ...ALIASES };
  }

  const api = { buildSecIndex, matchSec, aliasTable };
  if (isNode) module.exports = api;
  else root.LCTC = Object.assign(root.LCTC || {}, api);
})(typeof self !== 'undefined' ? self : this);
