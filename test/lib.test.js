const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../src/lib.js');

test('parseMoney handles levels.fyi formats', () => {
  assert.equal(L.parseMoney('$219K'), 219000);
  assert.equal(L.parseMoney('$47.4K'), 47400);
  assert.equal(L.parseMoney('$313,920'), 313920);
  assert.equal(L.parseMoney('$1.2M'), 1200000);
  assert.equal(L.parseMoney('--'), null);
});

test('formatMoney mirrors the original style', () => {
  assert.equal(L.formatMoney(171045, L.describeFormat('$219K')), '$171K');
  assert.equal(L.formatMoney(47355, L.describeFormat('$90.5K')), '$47.4K');
  assert.equal(L.formatMoney(7900, L.describeFormat('$7.9K')), '$7.9K');
  assert.equal(L.formatMoney(223920, L.describeFormat('$313,920')), '$223,920');
  assert.equal(L.formatMoney(1250000, L.describeFormat('$950K')), '$1.25M');
});

test('matches levels.fyi names to SEC EDGAR registrants', () => {
  // Real rows from sec.gov/files/company_tickers_exchange.json (+ two synthetic edge cases)
  const idx = L.buildSecIndex({
    fields: ['cik', 'name', 'ticker', 'exchange'],
    data: [
      [1652044, 'Alphabet Inc.', 'GOOGL', 'Nasdaq'],
      [1326801, 'Meta Platforms, Inc.', 'META', 'Nasdaq'],
      [19617, 'JPMORGAN CHASE & CO', 'JPM', 'NYSE'],
      [1639920, 'Spotify Technology S.A.', 'SPOT', 'NYSE'],
      [1874178, 'Rivian Automotive, Inc. / DE', 'RIVN', 'Nasdaq'],
      [804328, 'QUALCOMM INC/DE', 'QCOM', 'Nasdaq'],
      [1018724, 'AMAZON COM INC', 'AMZN', 'Nasdaq'],
      [1725033, 'X Financial', 'XYF', 'NYSE'],
      [908937, 'SIRIUS XM HOLDINGS INC.', 'SIRI', 'Nasdaq'],
      [1, 'VANTA HOLDINGS INC.', 'VNTXF', 'OTC'],
      [3, 'Adyen N.V./ADR', 'ADYYF', 'OTC'],
      [2, 'Delisted Inc', 'DLST', null],
    ],
  });
  const t = (...names) => L.matchSec(idx, names)?.ticker ?? null;
  assert.equal(t('Google'), 'GOOGL');
  assert.equal(t('YouTube'), 'GOOGL');
  assert.equal(t('Meta'), 'META');
  assert.equal(t('Facebook'), 'META');
  assert.equal(t('J.P. Morgan'), 'JPM');
  assert.equal(t('', 'jpmorgan-chase'), 'JPM'); // slug fallback
  assert.equal(t('Spotify'), 'SPOT');
  assert.equal(t('Rivian'), 'RIVN');
  assert.equal(t('Qualcomm'), 'QCOM');
  assert.equal(t('AWS'), 'AMZN');
  assert.equal(t('Stripe', 'stripe'), null);
  assert.equal(t('X'), null); // too short to match "X Financial"
  assert.equal(t('SiriusXM'), 'SIRI'); // spacing differs from "Sirius XM"
  assert.equal(t('SiriusXM + Pandora'), 'SIRI');
  assert.equal(t('Pandora'), 'SIRI');
  assert.equal(t('Vanta'), null); // OTC name collision with the startup -> ignored
  assert.equal(t('Adyen'), 'ADYYF'); // OTC ADR of a foreign-listed company -> kept
  assert.equal(L.matchSec(idx, ['Adyen']).otc, true);
  assert.equal(L.matchSec(idx, ['Google']).otc, false);
  assert.equal(t('Delisted'), null); // no exchange -> not traded
  assert.equal(t('Ring'), 'AMZN'); // aliases.js: subsidiary -> parent ticker
  assert.equal(t('Whole Foods'), 'AMZN');
  assert.equal(t('Instagram'), 'META');
});

test('Toronto Stock Exchange listings', () => {
  const sec = { fields: ['cik', 'name', 'ticker', 'exchange'], data: [[1, 'ROGERS CORP', 'ROG', 'NYSE'], [2, 'ROGERS COMMUNICATIONS INC', 'RCI', 'NYSE']] };
  const tsx = {
    results: [
      { symbol: 'CSU', name: 'Constellation Software Inc.' },
      { symbol: 'CVO', name: 'Coveo Solutions Inc.' },
      { symbol: 'WSRI', name: 'Wealthsimple North America Socially Responsible Index ETF' }, // fund -> ignored
      { symbol: 'PWF.PF.A', name: 'Power Financial Corporation' }, // preferred shares only -> ignored
      { symbol: 'POW', name: 'Power Corporation of Canada' },
    ],
  };
  const idx = L.buildSecIndex(sec, tsx);
  const m = (n) => L.matchSec(idx, [n]);
  assert.deepEqual([m('Constellation Software').ticker, m('Constellation Software').exchange], ['CSU', 'TSX']);
  assert.equal(m('Constellation Software').otc, false);
  assert.equal(m('Coveo').ticker, 'CVO'); // alias TSX:CVO
  assert.equal(m('Wealthsimple'), null);
  assert.equal(m('Power Corporation').ticker, 'POW');
  assert.equal(m('Rogers').ticker, 'RCI'); // alias beats unrelated "Rogers Corp"
  assert.equal(L.matchSec(L.buildSecIndex(sec), ['Constellation Software']), null); // TSX list is what adds it
});

test('aliases.js entries are well-formed', () => {
  const raw = require('../src/aliases.js');
  for (const [brand, ticker] of Object.entries(raw)) {
    assert.ok(brand.trim(), 'empty brand');
    assert.ok(ticker === null || /^(TSX:)?[A-Z][A-Z0-9.\-]*$/.test(ticker), `bad ticker for ${brand}: ${ticker}`);
  }
  // An alias whose parent no longer trades must not fall through to a name match.
  const idx = L.buildSecIndex({ fields: ['cik', 'name', 'ticker', 'exchange'], data: [[1, 'Twitch Corp', 'TWCH', 'NYSE']] });
  assert.equal(L.matchSec(idx, ['Twitch']), null); // alias -> AMZN, which isn't in this index
});

test('liquidTotal discounts only private equity', () => {
  // Stripe L1 averages from levels.fyi: total 219,414 = 157,045 + 47,355 + 15,014
  assert.equal(L.liquidTotal(219414, 47355, 'private', 0), 172059);
  assert.equal(L.liquidTotal(219414, 47355, 'private', 50), 219414 - 47355 / 2);
  assert.equal(L.liquidTotal(219414, 47355, 'private', 100), 219414);
  assert.equal(L.liquidTotal(219414, 47355, 'public', 0), 219414);
});

test('stockFromBreakdown reads combined TC cells', () => {
  const order = ['base', 'stock', 'bonus'];
  assert.equal(L.stockFromBreakdown('$313,920\n$180K | $90K | $20K', order), 90000);
  assert.equal(L.stockFromBreakdown('$200,000\n$180K | -- | $20K', order), 0);
  assert.equal(L.stockFromBreakdown('$313,920 $180K $90K $20K', order), 90000);
  assert.equal(L.stockFromBreakdown('$313,920', order), null);
  // Separators in their own elements, bonus missing (Coalition L1: $125K base + $32.5K RSUs)
  assert.equal(L.stockFromBreakdown('$157,500\n$125K\n|\n$32.5K\n|\n--', order), 32500);
  assert.equal(L.stockFromBreakdown('$157,500 $125K $32.5K --', order), 32500);
  assert.equal(L.stockFromBreakdown('$157,500\n$125K | -- | --', order), 0);
});
