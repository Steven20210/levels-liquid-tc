// Private companies whose employees can REGULARLY turn equity into cash: recurring company-run
// tender offers or buybacks. These show as "liquid" and use their own slider (default 75%),
// instead of the private-equity slider.
//
// Rules for adding entries:
//   - Private only. Public companies are matched against SEC/TSX first, so an entry for a company
//     that has since IPO'd is harmless (it just becomes "public"), but remove it when you notice.
//   - At least two employee liquidity events, the most recent within ~18 months. A one-off
//     secondary for founders/execs or investors only doesn't count.
//   - Every entry lists its sources. `tier` is the strongest source behind the entry:
//       'official'  = the company's own newsroom/blog/press release
//       'confirmed' = the company confirmed it to the press (spokesperson/CEO on record)
//       'press'     = press reports only (people familiar, memos)
//   - `note` is shown in the hover tooltip. Keys are normalized like aliases (case, punctuation,
//     "Inc." etc. don't matter). Brands/legal names of the same company share an entry.
//
// Status checked Nov 7, 2026. Full table with terms (caps, tenure): see README "Liquidity sources".
(function (root) {
  'use strict';

  const ENTRIES = {
    Stripe: {
      tier: 'official',
      note: 'yearly tenders: Mar 2023 ($50B), Feb 2024 ($65B), Feb 2025 ($91.5B), Feb 2026 ($159B)',
      sources: [
        'https://stripe.com/newsroom/news/stripe-series-i',
        'https://stripe.com/newsroom/news/employee-liquidity-feb-2024',
        'https://stripe.com/newsroom/news/employee-liquidity-feb-2025',
        'https://stripe.com/newsroom/news/stripe-2025-update',
      ],
    },
    ElevenLabs: {
      tier: 'official',
      note: 'employee tenders: Sep 2025 ($100M at $6.6B), Sep 2026 ($300M at $22B)',
      sources: [
        'https://elevenlabs.io/blog/announcing-an-employee-tender',
        'https://elevenlabs.io/blog/tender-22bn',
      ],
    },
    Clay: {
      tier: 'official',
      note: 'employee tenders: May 2025 ($1.5B), Jan 2026 (up to $55M at $5B)',
      sources: ['https://www.clay.com/blog/tender-offer', 'https://clay.com/blog/tender-offer-2026'],
    },
    Notion: {
      tier: 'official',
      note: 'employee share sales: Jul 2022 ($10B), Jan 2026 (~$270M at $11B)',
      sources: [
        'https://notion.com/blog/sequoia-index-purchase-shares-from-notion-employees',
        'https://www.notion.com/blog/gic-sequoia-index-purchase-notion-shares',
      ],
    },
    Rippling: {
      tier: 'official',
      note: 'tenders: Apr 2024 ($13.5B, $200M for employees), May 2025 (up to $200M buyback at $16.8B)',
      sources: [
        'https://www.rippling.com/blog/rippling-announces-series-f-fundraising-and-tender-offer',
        'https://www.rippling.com/blog/series-g-fundraising-tender-offer',
        'https://techcrunch.com/?p=2694472',
      ],
    },
    Revolut: {
      tier: 'official',
      note: 'employee share sales: Aug 2024 ($45B), Nov 2025 ($75B, its 5th), Nov 2026 ($115B)',
      sources: [
        'https://www.revolut.com/news/revolut_announces_secondary_share_sale_to_provide_employee_liquidity/',
        'https://www.rte.ie/news/business/2025/1124/1545556-revolut-valued-at-75-billion',
        'https://tech.eu/2026/11/04/revolut-confirms-115bn-valuation-after-completing-secondary-sale/',
      ],
    },
    Databricks: {
      tier: 'official',
      note: 'Series J (Dec 2024, $62B) funded employee liquidity; further rounds Dec 2025 ($134B)',
      sources: [
        'https://www.databricks.com/company/newsroom/press-releases/databricks-raising-10b-series-j-investment-62b-valuation',
        'https://www.databricks.com/company/newsroom/press-releases/databricks-announces-15B-financing-ai-talent-global-expansion',
        'https://builtin.com/articles/databricks-raises-4b-series-l-134b-valuation-20251216',
      ],
    },
    Ramp: {
      tier: 'official',
      note: 'employee share sales: Mar 2025 ($13B), Nov 2025 (tender at $32B)',
      sources: [
        'https://nbcbayarea.com/news/business/money-report/ramp-secures-13-billion-valuation-in-deal-allowing-employees-investors-to-sell-shares/3807150',
        'https://financialit.net/news/infrastructure/ramp-reaches-32-billion-valuation-doubling-revenue-and-customers-past-year',
      ],
    },
    Plaid: {
      tier: 'confirmed',
      note: 'employee tenders: Apr 2025 ($6.1B), Feb 2026 ($8B)',
      sources: [
        'https://fortune.com/2025/04/03/fintech-plaid-funding-round-fidelity-blackrock-franklin-templeton-nea-perret/',
        'https://news.crunchbase.com/fintech/plaid-completes-tender-offer-8b-valuation',
      ],
    },
    Anduril: {
      tier: 'confirmed',
      note: 'employee tenders, latest Oct 2026 (~$90B, capped at $1.3B)',
      sources: [
        'https://www.cnbc.com/2026/10/14/anduril-tender-offer-valuation.html',
        'https://equitybee.com/2025-vc-liquidity-tracker',
      ],
    },
    Gusto: {
      tier: 'confirmed',
      note: '3rd employee tender Jun 2025 (>$200M at $9.3B; 2+ years tenure)',
      sources: ['https://fortune.com/2025/06/09/gusto-200-million-plus-tender-offer'],
    },
    OpenAI: {
      tier: 'press',
      note: 'tenders: Dec 2024 ($157B, up to $10M each), Oct 2025 ($6.6B at $500B, up to $30M each), Aug 2026 (~$7B)',
      sources: [
        'https://www.entrepreneur.com/business-news/some-openai-employees-are-about-to-become-millionaires/484488',
        'https://www.implicator.ai/openai-lets-staff-sell-30m-each-in-october-employee-tender-program.md',
        'https://techstartups.com/2026/08/11/openai-completes-7-billion-employee-share-sale-at-852-billion-valuation-ahead-of-potential-ipo/',
      ],
    },
    Anthropic: {
      tier: 'press',
      note: 'buyback 2025 ($61.5B, up to 20% / $2M each); employee tender Feb–Apr 2026 ($350B)',
      sources: [
        'https://www.mostlymetrics.com/p/employee-secondaries',
        'https://www.bloomberg.com/news/articles/2026-02-04/anthropic-plans-employee-tender-offer-at-350-billion-valuation',
        'https://www.tipranks.com/news/anthropic-wraps-up-tender-offer-as-employees-resist-selling-shares-ahead-of-ipo',
      ],
    },
    // Exception to the two-event rule: single event, added at the maintainer's request (Nov 2026).
    // Announced with the Series F; the company's own release (Business Wire / GIC copy) could not be
    // read when this was added, and a completed close has not been independently confirmed.
    Vercel: {
      tier: 'press',
      note: '$300M tender for current and former employees announced with Series F (Sep 2025, $9.3B)',
      sources: [
        'https://siliconangle.com/?p=713960',
        'https://www.businesswire.com/news/home/20250930898216/en',
        'https://www.gic.com.sg/uploads/2025/09/Vercel-Closes-Series-F-at-9.3B-Valuation-to-Scale-the-AI-Cloud.pdf',
      ],
    },
    // Single-event entries added Nov 2026 at the maintainer's request (same exception as Vercel). Each was
    // opened and says employees could sell. Not added: Qonto and Crusoe (sale only planned/reported),
    // CRED (opt-in compensation programme, not a sale), PhonePe (2021).
    Cyera: {
      tier: 'official',
      note: 'employee tender Feb 2026 ($9B), led by Cyberstarts Employee Liquidity Fund',
      sources: ['https://www.cyera.com/press-releases/cyera-announces-employee-tender-offer-backed-to-by-cyberstarts-employee-liquidity-fund'],
    },
    Harvey: {
      tier: 'confirmed',
      note: 'first employee tender Dec 2025 ($8B); CEO says long-tenured staff can sell some shares',
      sources: ['https://legaltechnology.com/harvey-raises-160m-at-8bn-valuation-launches-shared-spaces-interview/'],
    },
    Cohere: {
      tier: 'confirmed',
      note: 'employee tender Oct 2025 for current employees (announced by the company)',
      sources: ['https://ng.investing.com/news/economy-news/cohere-offers-employees-chance-to-sell-stakes-as-revenue-hits-150-million-93CH-2154270'],
    },
    '1Password': {
      tier: 'confirmed',
      note: '$100M secondary Oct 2025 for long-tenured employees and founders ($6.8B); CEO quoted',
      sources: ['https://betakit.com/1password-holds-100-million-secondary-sale-inks-deal-to-deepen-ai-focus/'],
    },
    BrowserStack: {
      tier: 'press',
      note: '$125M ESOP buyback Jan 2026; about 500 employees sold vested options back',
      sources: ['https://india.entrepreneur.com/news-and-trends/browserstack-announces-usd-125-mn-esop-and-share-buyback/501794'],
    },
    Doctolib: {
      tier: 'press',
      note: '$345M secondary Apr 2026 sold by employees and early investors (~EUR 3.6B)',
      sources: ['https://inforcapital.com/news/doctolibs-valuation-slides-38-as-employees-and-early-investors-sell-345-million-in-secondary-share-sale/'],
    },
    Wayve: {
      tier: 'press',
      note: 'employee tenders: May 2024 (with Series C), Jun 2026 ($85M at $8.5B)',
      sources: ['https://techcrunch.com/2026/06/30/wayve-launches-85m-employee-tender-offer-at-8-5b-valuation/'],
    },
    Ripple: {
      tier: 'press',
      note: 'share buybacks: Jan 2025 ($125/share), Jun 2025 ($700M at $175/share), Mar 2026 (up to $750M)',
      sources: [
        'https://coingape.com/ripple-labs-announces-700m-share-buyback-at-175',
        'https://cryptovalleyjournal.com/background/ripple-launches-750-million-share-buyback-at-50-billion-valuation/',
      ],
    },
    // Single-event entries added Nov 2026 at the maintainer's request (same exception as Vercel), from the
    // research/rerun pass. Each source was opened and names employees as sellers. Several are secondary
    // blogs or unnamed-source reports, so treat them as "possible" rather than established programmes.
    // Not added (event older than ~18 months): Tanium 2017, Snyk 2021, PointClickCare 2021, ShareChat 2021,
    // Hopper 2022, OfBusiness Oct 2024. Not added (forum only): Scale AI.
    'Figure AI': {
      tier: 'confirmed',
      note: '$100M employee tender completed Jun 2026; CEO announced it',
      sources: ['https://www.humanoidsdaily.com/news/figure-completes-100-million-employee-tender-offer-as-robotics-talent-war-intensifies'],
    },
    'Checkout.com': {
      tier: 'confirmed',
      note: 'employee buyback Sep 2025 ($12B); company says staff with 1+ year tenure are eligible',
      sources: ['https://techcrunch.com/2025/09/26/checkout-coms-new-12b-valuation-is-a-glass-half-full-situation/'],
    },
    Gong: {
      tier: 'press',
      note: 'secondary for employees and investors Nov 2025 ($4.5B); Gong declined to confirm',
      sources: ['https://calcalistech.com/ctechnews/article/r1sdmq00ebx'],
    },
    NinjaOne: {
      tier: 'press',
      note: 'secondary Jun 2026 ($12.3B) letting shareholders and employees sell; employee share unclear',
      sources: ['https://ccstartup.com/blog/?p=384395'],
    },
    'VAST Data': {
      tier: 'press',
      note: 'secondary Apr 2026 (~$30B) in which employees and early investors can sell; not company-confirmed',
      sources: ['https://news.bloomberglaw.com/private-equity/nvidia-backed-vast-data-triples-value-to-30-billion-mulls-ipo'],
    },
    Socure: {
      tier: 'press',
      note: 'tender offer Aug 2026 alongside a $156M round let employees sell; size undisclosed',
      sources: ['https://www.under30ceo.com/fraud-prevention-socure-156m-fravity/'],
    },
  };

  // Other names levels.fyi may use for the same company.
  const ALSO_KNOWN_AS = {
    'Anduril Industries': 'Anduril',
    'Clay Labs': 'Clay',
    'Ripple Labs': 'Ripple',
    'Notion Labs': 'Notion',
    'Eleven Labs': 'ElevenLabs',
  };

  const LIQUID = { ...ENTRIES };
  for (const [alias, name] of Object.entries(ALSO_KNOWN_AS)) LIQUID[alias] = ENTRIES[name];

  if (typeof module !== 'undefined' && module.exports) module.exports = LIQUID;
  else root.LCTC_LIQUID = LIQUID;
})(typeof self !== 'undefined' ? self : this);
