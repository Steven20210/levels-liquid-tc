// Brand / subsidiary name (as levels.fyi might show it) -> SEC ticker of the PUBLIC company
// whose stock those employees are paid in.
//
// Why this exists: SEC EDGAR lists legal registrant names ("AMAZON COM INC", "Alphabet Inc."),
// so brands ("AWS", "YouTube") and subsidiaries ("Ring", "Whole Foods") don't match by name.
//
// Rules for adding entries:
//   - Only FULLY-owned subsidiaries whose employees receive the PARENT's public stock.
//     Separately-listed subsidiaries (Mobileye, GE Vernova) match on their own; subsidiaries
//     with their own private equity (Waymo, Verily, Zoox's ZARs) are deliberately omitted.
//   - Only acquisitions that have CLOSED (announced/pending deals stay out until they close).
//   - Value = ticker present in https://www.sec.gov/files/company_tickers_exchange.json on a
//     major exchange (or an ADR). `npm run verify-aliases` checks every entry against that file.
//   - Value `null` = force "private" (use for private companies whose name collides with an
//     unrelated listed company).
// Keys are normalized at load time (case, punctuation, "Inc." etc. don't matter).
//
// Deal status verified Nov 2026 (see README "Alias sources").
(function (root) {
  'use strict';

  const ALIASES = {
    // ---- Alphabet (GOOGL)
    'Google': 'GOOGL', 'Google Cloud': 'GOOGL', 'GCP': 'GOOGL', 'YouTube': 'GOOGL', 'DeepMind': 'GOOGL',
    'Google DeepMind': 'GOOGL', 'Fitbit': 'GOOGL', 'Nest': 'GOOGL', 'Google Nest': 'GOOGL', 'Mandiant': 'GOOGL',
    'Looker': 'GOOGL', 'Apigee': 'GOOGL', 'Kaggle': 'GOOGL', 'Waze': 'GOOGL', 'X Development': 'GOOGL',
    'X, the moonshot factory': 'GOOGL', 'Wiz': 'GOOGL', // Wiz closed Mar 11, 2026

    // ---- Meta (META)
    'Facebook': 'META', 'Instagram': 'META', 'WhatsApp': 'META', 'Oculus': 'META', 'Reality Labs': 'META',
    'Meta Reality Labs': 'META', 'Messenger': 'META', 'Threads': 'META', 'Meta Platforms': 'META',

    // ---- Amazon (AMZN)
    'Amazon': 'AMZN', 'AWS': 'AMZN', 'Amazon Web Services': 'AMZN', 'Twitch': 'AMZN', 'Zappos': 'AMZN',
    'Audible': 'AMZN', 'Ring': 'AMZN', 'Whole Foods': 'AMZN', 'Whole Foods Market': 'AMZN', 'One Medical': 'AMZN',
    'PillPack': 'AMZN', 'Amazon Pharmacy': 'AMZN', 'Project Kuiper': 'AMZN', 'Amazon Kuiper': 'AMZN',
    'Amazon Leo': 'AMZN', 'IMDb': 'AMZN', 'Goodreads': 'AMZN', 'eero': 'AMZN', 'Amazon MGM Studios': 'AMZN',
    'MGM Studios': 'AMZN', 'Amazon Robotics': 'AMZN', 'Annapurna Labs': 'AMZN', 'Lab126': 'AMZN', 'A9': 'AMZN',
    'Wondery': 'AMZN', 'Woot': 'AMZN', 'Shopbop': 'AMZN', 'Blink': 'AMZN', 'Amazon Games': 'AMZN',
    'Prime Video': 'AMZN', 'Amazon Prime Video': 'AMZN', 'Amazon Studios': 'AMZN',

    // ---- Microsoft (MSFT)
    'LinkedIn': 'MSFT', 'GitHub': 'MSFT', 'Activision': 'MSFT', 'Activision Blizzard': 'MSFT', 'Blizzard': 'MSFT',
    'Blizzard Entertainment': 'MSFT', 'King': 'MSFT', 'Bethesda': 'MSFT', 'ZeniMax': 'MSFT', 'Mojang': 'MSFT',
    'Xbox': 'MSFT', 'Nuance': 'MSFT', 'Nuance Communications': 'MSFT', 'Skype': 'MSFT', 'Microsoft AI': 'MSFT',
    'Azure': 'MSFT',

    // ---- Apple (AAPL)
    'Beats': 'AAPL', 'Beats by Dre': 'AAPL',

    // ---- Nvidia / AMD / Intel / Qualcomm / Broadcom / Synopsys / Cadence / TSMC
    'Mellanox': 'NVDA', 'AMD': 'AMD', 'Xilinx': 'AMD', 'Pensando': 'AMD', 'ZT Systems': 'AMD', 'Silo AI': 'AMD',
    'Habana Labs': 'INTC', 'Nuvia': 'QCOM', 'Alphawave': 'QCOM', 'Alphawave Semi': 'QCOM', // Dec 2025
    'VMware': 'AVGO', 'CA Technologies': 'AVGO', 'Symantec Enterprise': 'AVGO', 'Brocade': 'AVGO',
    'Ansys': 'SNPS', // Jul 2025
    'Cadence': 'CDNS', 'TSMC': 'TSM', 'Taiwan Semiconductor': 'TSM',

    // ---- Enterprise software
    'Slack': 'CRM', 'Tableau': 'CRM', 'MuleSoft': 'CRM', 'Heroku': 'CRM', 'Informatica': 'CRM', // Nov 2025
    'Splunk': 'CSCO', 'Cisco': 'CSCO', 'Meraki': 'CSCO', 'Cisco Meraki': 'CSCO', 'Webex': 'CSCO',
    'AppDynamics': 'CSCO', 'ThousandEyes': 'CSCO', 'Duo Security': 'CSCO', 'Isovalent': 'CSCO',
    'IBM': 'IBM', 'Red Hat': 'IBM', 'HashiCorp': 'IBM', 'Confluent': 'IBM', // HashiCorp Feb 2025, Confluent Mar 2026
    'Apptio': 'IBM', 'Turbonomic': 'IBM', 'Instana': 'IBM', 'Hakkoda': 'IBM',
    'Cerner': 'ORCL', 'Oracle Health': 'ORCL', 'NetSuite': 'ORCL', 'Oracle Cloud Infrastructure': 'ORCL', 'OCI': 'ORCL',
    'Frame.io': 'ADBE', 'Marketo': 'ADBE', 'Workfront': 'ADBE', 'Behance': 'ADBE',
    'TurboTax': 'INTU', 'QuickBooks': 'INTU', 'Credit Karma': 'INTU', 'Mailchimp': 'INTU',
    'Moveworks': 'NOW', 'Loom': 'TEAM', 'Trello': 'TEAM', 'Auth0': 'OKTA', 'Segment': 'TWLO', 'SendGrid': 'TWLO',
    'Linode': 'AKAM', 'Arize': 'DT', 'Arize AI': 'DT', // Oct 2026
    'SAP Concur': 'SAP', 'Concur': 'SAP', 'SuccessFactors': 'SAP', 'SAP SuccessFactors': 'SAP', 'Ariba': 'SAP',
    'SAP Ariba': 'SAP', 'Signavio': 'SAP', 'LeanIX': 'SAP', 'WalkMe': 'SAP',
    'Cognizant': 'CTSH',

    // ---- Security
    'CyberArk': 'PANW', 'Protect AI': 'PANW', // CyberArk Feb 2026
    'Red Canary': 'ZS',

    // ---- Hardware / networking
    'Juniper': 'HPE', 'Juniper Networks': 'HPE', 'Aruba': 'HPE', 'Aruba Networks': 'HPE', // Juniper Jul 2025
    'HP': 'HPQ', 'Poly': 'HPQ', 'Plantronics': 'HPQ', 'HyperX': 'HPQ',

    // ---- Payments / fintech
    'Venmo': 'PYPL', 'Braintree': 'PYPL', 'Xoom': 'PYPL', 'PayPal Honey': 'PYPL',
    'Block': 'XYZ', 'Square': 'XYZ', 'Cash App': 'XYZ', 'Afterpay': 'XYZ', 'Tidal': 'XYZ',
    'Worldpay': 'GPN', // Jan 2026
    'Coinbase': 'COIN', 'Robinhood': 'HOOD', 'Circle': 'CRCL', 'Gemini': 'GEMI',

    // ---- Banks / brokers / exchanges
    'JPMorgan': 'JPM', 'JP Morgan': 'JPM', 'J.P. Morgan': 'JPM', 'JPMorgan Chase': 'JPM', 'Chase': 'JPM',
    'Bank of America': 'BAC', 'BofA': 'BAC', 'BofA Securities': 'BAC', 'Merrill': 'BAC', 'Merrill Lynch': 'BAC',
    'Citi': 'C', 'Citibank': 'C',
    'Charles Schwab': 'SCHW', 'Schwab': 'SCHW', 'TD Ameritrade': 'SCHW',
    'E*TRADE': 'MS', 'E-Trade': 'MS', 'Eaton Vance': 'MS',
    'Capital One': 'COF', 'Discover': 'COF', 'Discover Financial': 'COF', 'Discover Financial Services': 'COF', // May 2025
    'Amex': 'AXP',
    'NYSE': 'ICE', 'New York Stock Exchange': 'ICE', 'Black Knight': 'ICE',
    'S&P': 'SPGI', 'IHS Markit': 'SPGI', 'Reuters': 'TRI',

    // ---- Telecom / cable
    'Verizon': 'VZ', 'Frontier Communications': 'VZ', // Jan 2026
    'T-Mobile': 'TMUS', 'Sprint': 'TMUS', 'Mint Mobile': 'TMUS', 'Metro by T-Mobile': 'TMUS',
    'Spectrum': 'CHTR', 'Charter': 'CHTR', 'Charter Communications': 'CHTR', 'Cox Communications': 'CHTR', // Cox closed 2026

    // ---- Media / entertainment
    'Disney': 'DIS', 'Walt Disney': 'DIS', 'Pixar': 'DIS', 'Marvel': 'DIS', 'Marvel Studios': 'DIS',
    'Lucasfilm': 'DIS', 'Industrial Light & Magic': 'DIS', 'ILM': 'DIS', 'ESPN': 'DIS', 'Hulu': 'DIS',
    'ABC': 'DIS', 'Disney Streaming': 'DIS', 'Disney+': 'DIS',
    'NBCUniversal': 'CMCSA', 'NBCU': 'CMCSA', 'Peacock': 'CMCSA', 'Xfinity': 'CMCSA', 'Comcast': 'CMCSA',
    'DreamWorks Animation': 'CMCSA', 'Universal Pictures': 'CMCSA', 'NBC': 'CMCSA',
    'Fox': 'FOXA', 'Fox Corporation': 'FOXA', 'Tubi': 'FOXA', 'Roku': 'FOXA', // Roku closed Nov 6, 2026
    // Paramount Skydance (registrant now "Skydance Corp") acquired Warner Bros. Discovery, closed Oct 6, 2026
    'Paramount': 'SKYD', 'Paramount Skydance': 'SKYD', 'Paramount Global': 'SKYD', 'CBS': 'SKYD',
    'Paramount+': 'SKYD', 'Pluto TV': 'SKYD', 'Showtime': 'SKYD', 'Nickelodeon': 'SKYD',
    'Warner Bros': 'SKYD', 'Warner Bros.': 'SKYD', 'Warner Bros. Discovery': 'SKYD', 'WBD': 'SKYD',
    'HBO': 'SKYD', 'HBO Max': 'SKYD', 'CNN': 'SKYD', 'Warner Bros. Games': 'SKYD',
    'Sony': 'SONY', 'PlayStation': 'SONY', 'Sony Interactive Entertainment': 'SONY', 'Sony Pictures': 'SONY',
    'Sony Music': 'SONY', 'Bungie': 'SONY', 'Insomniac Games': 'SONY', 'Crunchyroll': 'SONY',
    'Rockstar Games': 'TTWO', '2K': 'TTWO', '2K Games': 'TTWO', 'Zynga': 'TTWO',
    'Tinder': 'MTCH', 'Hinge': 'MTCH', 'OkCupid': 'MTCH',
    'SiriusXM': 'SIRI', 'Pandora': 'SIRI',

    // ---- SpaceX (public since 2026; acquired xAI, which owned X, Feb 2026; Cursor Aug 2026)
    'SpaceX': 'SPCX', 'SpaceXAI': 'SPCX', 'Starlink': 'SPCX', 'xAI': 'SPCX', 'X': 'SPCX', 'Twitter': 'SPCX',
    'X Corp': 'SPCX', 'Cursor': 'SPCX', 'Anysphere': 'SPCX',

    // ---- Consumer internet / commerce / travel
    'Uber Eats': 'UBER', 'Postmates': 'UBER',
    'Wolt': 'DASH', 'Deliveroo': 'DASH', // Deliveroo Oct 2025
    'Instacart': 'CART',
    'Booking.com': 'BKNG', 'Priceline': 'BKNG', 'Kayak': 'BKNG', 'Agoda': 'BKNG', 'OpenTable': 'BKNG',
    'Vrbo': 'EXPE', 'Hotels.com': 'EXPE', 'Orbitz': 'EXPE', 'Travelocity': 'EXPE',
    'Temu': 'PDD', 'Pinduoduo': 'PDD', 'Shopee': 'SE', 'Garena': 'SE',
    'Sam\'s Club': 'WMT', 'Walmart Global Tech': 'WMT', 'Walmart Labs': 'WMT', 'Jet.com': 'WMT',
    'Redfin': 'RKT', 'Mr. Cooper': 'RKT', 'Rocket': 'RKT', 'Rocket Mortgage': 'RKT', // Redfin Jul 2025, Mr. Cooper Oct 2025
    'Anywhere Real Estate': 'COMP', // Jan 2026

    // ---- Health
    'Optum': 'UNH', 'UnitedHealthcare': 'UNH', 'Change Healthcare': 'UNH',
    'Aetna': 'CVS', 'Oak Street Health': 'CVS', 'Signify Health': 'CVS', 'CVS Health': 'CVS',
    'Evernorth': 'CI', 'Express Scripts': 'CI', 'Anthem': 'ELV',
    'Janssen': 'JNJ', 'Johnson & Johnson': 'JNJ', 'Lilly': 'LLY', 'Livongo': 'TDOC',
    'Hims': 'HIMS', 'Hims & Hers': 'HIMS', 'Oscar': 'OSCR', 'Clover Health': 'CLOV', 'Tempus': 'TEM',
    'Recursion': 'RXRX', 'Ginkgo': 'DNA', 'Ginkgo Bioworks': 'DNA',

    // ---- Industrial / aerospace / auto
    'Spirit AeroSystems': 'BA', // Dec 2025
    'Raytheon': 'RTX', 'Pratt & Whitney': 'RTX', 'Collins Aerospace': 'RTX',
    'GE Aerospace': 'GE', 'Gulfstream': 'GD', 'Cruise': 'GM', 'GM': 'GM',
    'Toyota': 'TM', 'Honda': 'HMC',

    // ---- Canada. US-interlisted companies use their NYSE/Nasdaq ticker; Toronto-only ones use
    //      "TSX:SYMBOL" (from the TMX company directory).
    'RBC': 'RY', 'Royal Bank': 'RY', 'RBC Capital Markets': 'RY',
    'TD': 'TD', 'TD Bank': 'TD', 'TD Securities': 'TD', 'Toronto-Dominion': 'TD',
    'BMO': 'BMO', 'BMO Capital Markets': 'BMO', 'Scotiabank': 'BNS', 'CIBC': 'CM',
    'Rogers': 'RCI', 'Rogers Communications': 'RCI', 'Bell Canada': 'BCE', 'Bell Media': 'BCE',
    'Lightspeed': 'LSPD', 'Lightspeed Commerce': 'LSPD', 'Descartes': 'DSGX', 'Magna': 'MGA',
    'CN': 'CNI', 'CN Rail': 'CNI', 'CPKC': 'CP', 'Canadian Pacific': 'CP', 'Canadian Pacific Kansas City': 'CP',
    'Suncor': 'SU', 'Cenovus': 'CVE', 'Barrick': 'B', 'Barrick Gold': 'B', 'ecobee': 'GNRC',
    'Loblaw': 'TSX:L', 'Loblaws': 'TSX:L', 'Shoppers Drug Mart': 'TSX:L', 'Coveo': 'TSX:CVO',
    'Thinkific': 'TSX:THNC', 'Sobeys': 'TSX:EMP.A', 'Empire Company': 'TSX:EMP.A', 'Enghouse': 'TSX:ENGH',
    'Power Corporation': 'TSX:POW', 'Power Corp': 'TSX:POW',

    // ---- Recent IPOs whose SEC name differs from the brand
    'Cerebras': 'CBRS', 'Nubank': 'NU', 'Zoom': 'ZM', 'Rivian': 'RIVN',
    // Rivian–VW software JV (50/50, consolidated by Rivian; Volkswagen itself isn't SEC/TSX-listed)
    'Rivian and Volkswagen Group Technologies': 'RIVN', 'Rivian and Volkswagen Group Technology': 'RIVN',
    'Rivian and VW Group Technologies': 'RIVN', 'Rivian and VW Group Technology': 'RIVN', 'Rivian VW': 'RIVN',
    'Rivian Volkswagen': 'RIVN', 'RV Tech': 'RIVN', 'Peloton': 'PTON', 'Unity': 'U',

    // ---- Other renamed / differently-registered companies
    'Verizon Wireless': 'VZ', 'Costco': 'COST', 'P&G': 'PG', 'Procter & Gamble': 'PG',
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = ALIASES;
  else root.LCTC_ALIASES = ALIASES;
})(typeof self !== 'undefined' ? self : this);
