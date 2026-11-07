# Levels.fyi Liquid TC

Chrome extension that replaces the **Total Compensation** column on levels.fyi with **liquid TC**: compensation you can actually sell or spend.

| Company  | Liquid TC shown                                |
| -------- | ---------------------------------------------- |
| Public   | base + bonus + stock (unchanged — public stock can be sold) |
| Private  | base + bonus + illiquid stock × *your slider* (default 0%) |

Hover a modified cell to see the original TC, the stock amount, and why the company was classified as public/private. Each TC cell gets a thin colored edge: purple = private (discounted), green = public, grey = unknown or still looking up (left untouched).

## Install

1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select this folder
3. On any levels.fyi salary table, use the control bar right under the grey header row: **Liquid TC** toggle + private-equity slider. (The toolbar popup has the same controls plus per-company public/private overrides.)

The extension also hides the "levels.fyi" watermark that the site stamps into table rows.

## How public vs. private is detected

No levels.fyi lookups. Two public listing directories, each downloaded **once a day** by the background service worker and matched locally — nothing about you or the pages you view is sent anywhere:

1. **SEC EDGAR** — `https://www.sec.gov/files/company_tickers_exchange.json`: every SEC-registered ticker **with the exchange it trades on** (Nasdaq, NYSE, CBOE, TXSE, OTC). ~10k tickers, no API key. The SEC's fair-access policy rejects requests without a descriptive `User-Agent`; `fetch()` can't set that header, so `rules.json` sets `levels-liquid-tc/0.5 (...)` on requests to that one URL only.
2. **Toronto Stock Exchange** — `https://www.tsx.com/json/company-directory/search/tsx/^*`: the data behind TMX Group's [Listed Company Directory](https://tsx.com/en/listings/listing-with-us/listed-company-directory). Adds Toronto-only companies (Constellation Software, Kinaxis, Loblaw, Canadian Tire, Hydro One, Coveo, …). ETFs, funds and preferred-share-only issuers are filtered out; TSX Venture is deliberately excluded (same name-collision risk as OTC). This endpoint is undocumented, so it's optional: if it fails, the extension keeps working with SEC data and retries within an hour.

- A company is **public** if its levels.fyi name matches a company listed on a U.S. exchange or the TSX (U.S. listing preferred when both exist). Tickers with no exchange (not trading) are ignored. OTC tickers are ignored too unless they're ADRs of foreign-listed companies (e.g. Adyen) — OTC is full of small companies whose names collide with startups ("Vanta Holdings" vs. Vanta).
- Matching normalizes legal suffixes (`Inc.`, `Corp`, `S.A.`, `Holdings`, `Technologies`, `US`, …), ignores spacing (`SiriusXM` = `Sirius XM`), and tries each part of compound names (`SiriusXM + Pandora`).
- **Aliases** (`src/aliases.js`, ~350 entries) map brands and subsidiaries to the ticker of the public parent whose stock employees receive: `'Ring': 'AMZN'`, `'YouTube': 'GOOGL'`, `'Wiz': 'GOOGL'`, `'Cursor': 'SPCX'`. Toronto-only companies use `TSX:SYMBOL` (`'Coveo': 'TSX:CVO'`). Aliases are checked before name matching, so they also prevent wrong matches (e.g. "Evernorth" → Cigna, not the unrelated *Evernorth Holdings*).
- Limits: companies listed only outside the U.S. and Canada with no SEC registration (e.g. Tencent, Nintendo), and TSX Venture companies, show as private. Use the per-company override in the toolbar popup for those.

## Maintaining aliases

Rules (also at the top of `src/aliases.js`): only fully-owned subsidiaries paid in the parent's stock; only acquisitions that have **closed**; subsidiaries with their own private equity (Waymo, Verily, Zoox) stay out; `null` forces "private".

```
npm run verify-aliases                     # checks every alias against the live SEC file
npm run verify-aliases -- sec.json tsx.json   # or local copies
```

It fails if a ticker isn't trading (e.g. the parent was taken private) or two brands collide, notes brands that would otherwise match a *different* company by name, and prints brand → ticker → SEC registrant for review.

### Alias sources (deal status as of Nov 2026)

Long-standing subsidiaries (YouTube, Instagram, LinkedIn, …) are well known. Recent deals were confirmed closed before being added:

- Google–Wiz (Mar 11, 2026): [Cleary Gottlieb](https://www.clearygottlieb.com/news-and-insights/news-listing/google-completes-32-billion-acquisition-of-wiz)
- IBM–Confluent (Mar 17, 2026): [ChannelWeb](https://www.channelweb.co.uk/news-network/2026/ibm-completes-11bn-confluent-acquisition); IBM–HashiCorp (Feb 2025), HPE–Juniper (Jul 2025): [CIO](https://www.cio.com/article/196371/the-biggest-enterprise-technology-ma-deals.html)
- Palo Alto Networks–CyberArk (Feb 11, 2026), Verizon–Frontier (Jan 20, 2026): [Fierce Network 2026 tracker](https://www.fierce-network.com/broadband/2026-ma-tracker)
- Salesforce–Informatica (Nov 18, 2025): [Seeking Alpha](https://seekingalpha.com/news/4523363-salesforce-completes-acquisition-of-informatica)
- Fox–Roku (Nov 6, 2026): [TechCrunch](https://techcrunch.com/2026/11/06/fox-completes-its-22b-acquisition-of-roku)
- Paramount Skydance–Warner Bros. Discovery (Oct 6, 2026): [Wikipedia](https://en.wikipedia.org/wiki/Acquisition_of_Warner_Bros._Discovery_by_Paramount_Skydance)
- SpaceX–xAI/X (Feb 2026): [Motley Fool](https://www.fool.com/investing/2026/02/22/what-you-need-to-know-about-the-spacex-xai-merger/); SpaceX–Cursor (Aug 14, 2026): [Fierce Network](https://www.fierce-network.com/broadband/2026-ma-tracker)
- Charter–Cox: [MLex](https://www.mlex.com/mlex/amp/articles/2515920); DoorDash–Deliveroo (Oct 2, 2025): [Business Wire](https://secure.businesswire.com/news/home/20251002060133/en/DoorDash-Completes-Acquisition-of-Deliveroo)
- Rocket–Redfin (Jul 2025) / Mr. Cooper (Oct 2025): [Scotsman Guide](https://www.scotsmanguide.com/news/rocket-completes-mr-cooper-acquisition/); Boeing–Spirit AeroSystems (Dec 8, 2025): [Boeing](https://investors.boeing.com/investors/news/press-release-details/2025/Boeing-Completes-Acquisition-of-Spirit-AeroSystems/default.aspx)
- Qualcomm–Alphawave (Dec 2025): [Yahoo Finance](https://finance.yahoo.com/news/qualcomm-wraps-2-4bn-acquisition-102203211.html); Global Payments–Worldpay (Jan 12, 2026): [Business Wire](https://secure.businesswire.com/news/home/20260112224066/en/Global-Payments-Completes-Acquisition-of-Worldpay-and-Divestiture-of-Issuer-Solutions-Business-Creating-Leading-Pure-Play-Commerce-Solutions-Provider)
- Not added (unconfirmed / pending): Capital One–Brex, IBM–DataStax, Amazon–Globalstar, Marvell–Lumentum. Not added (own private equity): Zoox (Amazon RSUs **plus** Zoox ZARs).

## Development

```
npm test   # unit tests for parsing / classification (Node 18+)
```

`src/lib.js` holds the pure logic; `src/content.js` handles the DOM (finds tables whose header contains "Total" / "Total Compensation" and a stock column or a `Base | Stock | Bonus` breakdown).
