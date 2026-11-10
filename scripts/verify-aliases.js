#!/usr/bin/env node
// Verifies src/data/aliases.js against the SEC EDGAR exchange list.
//
//   npm run verify-aliases                                  # downloads the SEC + TSX lists
//   npm run verify-aliases -- sec.json [tsx.json]           # or uses local copies
//
// FAIL  - alias ticker not trading on a major exchange (or as an ADR) -> fix or remove the entry
// FAIL  - two brands normalize to the same key but map to different tickers
// NOTE  - the brand would ALSO match a different listed company by name (the alias is what
//         prevents a wrong match - keep it)
// Prints every brand -> ticker -> SEC registrant so the mappings can be eyeballed.
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('../src/core');
const RAW = require('../src/data/aliases.js');

const SEC_URL = 'https://www.sec.gov/files/company_tickers_exchange.json';
const TSX_URL = 'https://www.tsx.com/json/company-directory/search/tsx/%5E*';
const UA = 'levels-liquid-tc/0.6 alias-verifier (open-source Chrome extension)';

async function load(file, url, name) {
  if (file) return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(name + ' returned HTTP ' + res.status);
  return res.json();
}

(async () => {
  const sec = await load(process.argv[2], SEC_URL, 'SEC');
  const tsx = await load(process.argv[3], TSX_URL, 'TSX');
  const index = L.buildSecIndex(sec, tsx);
  // What would the brand match on name alone (ignoring aliases)?
  const directMatch = (brand) => {
    const n = L.normalizeName(brand.replace(/-/g, ' '));
    for (const key of [n.length >= 2 ? n : null, n.replace(/ /g, '').length >= 3 ? n.replace(/ /g, '') : null]) {
      if (key && index[key]) return index[key].split('|');
    }
    return null;
  };

  let fails = 0;
  const seen = new Map(); // normalized key -> [brand, ticker]
  const rows = [];
  for (const [brand, ticker] of Object.entries(RAW)) {
    const n = L.normalizeName(brand.replace(/-/g, ' '));
    for (const k of [n, n.replace(/ /g, '')]) {
      const prev = seen.get(k);
      if (prev && prev[1] !== ticker) {
        console.log(`FAIL  key collision "${k}": "${prev[0]}" -> ${prev[1]} vs "${brand}" -> ${ticker}`);
        fails++;
      }
      seen.set(k, [brand, ticker]);
    }
    if (ticker === null) {
      rows.push([brand, '(private)', '', '']);
      continue;
    }
    const entry = index['$' + ticker];
    if (!entry) {
      console.log(`FAIL  "${brand}" -> ${ticker}: ticker not trading on a major U.S. exchange / the TSX / as an ADR`);
      fails++;
      continue;
    }
    const [, title, exch] = entry.split('|');
    const direct = directMatch(brand);
    if (direct && direct[0] !== ticker.replace(/^TSX:/, '')) {
      console.log(`NOTE  "${brand}" by name alone would match ${direct[0]} (${direct[1]}) - alias overrides to ${ticker}`);
    }
    rows.push([brand, ticker, exch, title]);
  }

  console.log('\nBrand'.padEnd(34) + 'Ticker'.padEnd(8) + 'Exchange'.padEnd(10) + 'SEC registrant');
  for (const [b, t, e, title] of rows.sort((x, y) => x[1].localeCompare(y[1]) || x[0].localeCompare(y[0]))) {
    console.log(b.padEnd(33) + String(t).padEnd(8) + e.padEnd(10) + title);
  }
  console.log(`\n${rows.length} aliases, ${fails} failure(s)`);
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
