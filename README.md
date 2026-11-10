# Levels.fyi Liquid TC

Chrome extension that replaces the **Total Compensation** column on levels.fyi with **liquid TC**: compensation you can actually sell or spend.

| Company | Liquid TC shown |
| --- | --- |
| Public | base + bonus + stock |
| Private with regular tenders (OpenAI, Stripe, …) | base + bonus + stock × *liquid slider* (default 75%) |
| Private | base + bonus + stock × *private slider* (default 0%) |

Hover a modified cell to see the original TC and why the company was classified that way.

## Install

1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select this folder
3. On a levels.fyi salary table, use the control bar under the header row. The toolbar popup turns the extension on or off.

## How it works

Public companies are detected by matching names against the [SEC EDGAR](https://www.sec.gov/files/company_tickers_exchange.json) and [TSX](https://tsx.com/en/listings/listing-with-us/listed-company-directory) listings, downloaded once a day. Nothing about you or the pages you view is sent anywhere.

Private companies with regular employee tender offers are listed by hand in `src/data/liquidity.js`, each with sources. Full research: [tender offer research doc](https://claude.ai/artifact/V8MtBjqyW5LQE4GgDVGnH8).

## Development

```
npm test
```

- `src/core/` — pure logic, unit-tested in Node
- `src/data/` — hand-maintained company tables
- `src/content/` — levels.fyi page code
- `src/background/` — downloads and caches the SEC / TSX lists

## Disclaimer

Figures and classifications are rough estimates from public sources and may be wrong or out of date. Not financial advice. Not affiliated with levels.fyi, the SEC, TMX Group or any listed company.

## License

[MIT](LICENSE)
