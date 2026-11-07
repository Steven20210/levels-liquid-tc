(() => {
  'use strict';
  const L = self.LCTC;

  const DEFAULTS = { enabled: false, privateEquityPct: 0, overrides: {} };
  const CACHE_KEY = 'companies'; // companies seen on levels.fyi, for the popup's override list

  let settings = { ...DEFAULTS };
  let seen = {}; // slug -> { type, reason, name, lastSeen }

  // SEC EDGAR index of listed companies, fetched by the background worker.
  let sec = { state: 'loading', index: null, error: null };

  // Text nodes we've rewritten: node -> { orig, applied }
  const records = new Map();
  // Cells/headers we've decorated: el -> original title (or null)
  const decorated = new Map();

  // ---------- SEC index ----------

  async function loadSecIndex(force) {
    sec = { ...sec, state: 'loading' };
    try {
      const res = await chrome.runtime.sendMessage({ type: 'getSecIndex', force: !!force });
      if (!res || !res.ok) throw new Error(res ? res.error : 'no response from background');
      sec = { state: 'ready', index: res.index, error: res.error || null };
    } catch (e) {
      sec = { state: 'error', index: null, error: e.message };
    }
    scheduleProcess();
  }

  // ---------- seen-companies list (for the popup) ----------

  let saveTimer = null;
  function saveSeenSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => chrome.storage.local.set({ [CACHE_KEY]: seen }), 1000);
  }

  function noteSeen(slug, name, status) {
    const prev = seen[slug];
    const now = Date.now();
    if (prev && prev.type === status.type && prev.reason === status.reason && now - (prev.lastSeen || 0) < 60000) return;
    seen[slug] = { type: status.type, reason: status.reason, name: name || slug, lastSeen: now };
    saveSeenSoon();
  }

  /** Public if the company (or its parent, via alias) is in the SEC's list of listed companies. */
  function statusFor(slug, name) {
    const ov = settings.overrides[slug];
    if (ov === 'public' || ov === 'private') return { type: ov, reason: 'your override' };
    if (sec.state === 'loading') return { type: 'unknown', reason: 'loading SEC company list…' };
    if (sec.state === 'error') return { type: 'unknown', reason: 'SEC list unavailable: ' + sec.error };

    const m = L.matchSec(sec.index, [name, slug]);
    const status = m
      ? {
          type: 'public',
          reason: `${m.ticker} on ${m.exchange}${m.otc ? ' (ADR of a foreign-listed company)' : ''} — ${m.title}` +
            ` (source: ${m.exchange === 'TSX' ? 'TMX/TSX company directory' : 'SEC EDGAR'})`,
        }
      : { type: 'private', reason: 'not listed on a U.S. exchange (SEC EDGAR) or the Toronto Stock Exchange' };
    noteSeen(slug, name, status);
    return status;
  }

  function pageCompanyName(slug) {
    try {
      const c = JSON.parse(document.getElementById('__NEXT_DATA__').textContent)?.props?.pageProps?.company;
      return c && c.slug === slug ? c.name : null;
    } catch (_) {
      return null;
    }
  }

  // ---------- table parsing ----------

  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const textOf = (el) => (el ? el.innerText || el.textContent || '' : '');

  /** Map visual column index -> cell, honoring colSpan. */
  function cellsByCol(row) {
    const out = [];
    let col = 0;
    for (const cell of row.cells) {
      out[col] = cell;
      col += cell.colSpan || 1;
    }
    return out;
  }

  function analyzeTable(table) {
    const headRows = table.tHead ? [...table.tHead.rows].filter((r) => !r.classList.contains('lctc-bar-row')) : [];
    const headRow = headRows[headRows.length - 1];
    if (!headRow) return null;
    const heads = cellsByCol(headRow);
    let totalCol = -1;
    let stockCol = -1;
    let order = null;
    heads.forEach((th, i) => {
      if (!th) return;
      const t = norm(textOf(th));
      const isTotal =
        /total comp/.test(t) || (/^total\b/.test(t) && !/experience|at company|yoe/.test(t));
      if (totalCol < 0 && isTotal) {
        totalCol = i;
        const keys = ['base', 'stock', 'bonus'].map((k) => [k, t.indexOf(k)]).filter(([, p]) => p >= 0);
        order = keys.sort((a, b) => a[1] - b[1]).map(([k]) => k);
      } else if (stockCol < 0 && /\bstock\b/.test(t)) {
        // "Stock (/yr)", "First Year Stock", ...
        stockCol = i;
      }
    });
    if (totalCol < 0) return null;
    if (stockCol < 0 && !(order && order.includes('stock'))) return null; // no way to find equity
    return { headCell: heads[totalCol], totalCol, stockCol, order, colCount: heads.length };
  }

  // ---------- in-page control bar (sits right under the grey table header) ----------

  function buildBar(colCount) {
    const tr = document.createElement('tr');
    tr.className = 'lctc-bar-row';
    const td = document.createElement('td');
    td.colSpan = colCount;
    td.innerHTML = `
      <div class="lctc-bar">
        <label class="lctc-toggle" title="Replace TC with liquid TC: public stock counts (it can be sold), private equity counts at the slider %">
          <input type="checkbox" class="lctc-enabled" />
          <span class="lctc-switch"></span>
          <span>Liquid TC</span>
        </label>
        <label class="lctc-slider" title="How much private-company stock is worth to you">
          <span>Private equity counted at <b class="lctc-pct-label"></b></span>
          <input type="range" class="lctc-pct" min="0" max="100" step="5" />
        </label>
        <span class="lctc-legend">
          <i class="lctc-dot lctc-dot-private"></i>private
          <i class="lctc-dot lctc-dot-public"></i>public
          <i class="lctc-dot lctc-dot-unknown"></i>unknown
        </span>
      </div>`;
    tr.appendChild(td);

    // Keep clicks from reaching levels.fyi's sort / row handlers.
    for (const ev of ['click', 'mousedown', 'pointerdown', 'keydown']) {
      td.addEventListener(ev, (e) => e.stopPropagation());
    }
    td.querySelector('.lctc-enabled').addEventListener('change', (e) => {
      chrome.storage.sync.set({ enabled: e.target.checked });
    });
    const range = td.querySelector('.lctc-pct');
    range.addEventListener('input', () => {
      // Live preview while dragging; persisted on release.
      settings.privateEquityPct = Number(range.value);
      syncBars();
      scheduleProcess();
    });
    range.addEventListener('change', () => {
      chrome.storage.sync.set({ privateEquityPct: Number(range.value) });
    });
    return tr;
  }

  function syncBars() {
    for (const bar of document.querySelectorAll('.lctc-bar')) {
      const cb = bar.querySelector('.lctc-enabled');
      const range = bar.querySelector('.lctc-pct');
      if (cb.checked !== !!settings.enabled) cb.checked = !!settings.enabled;
      if (document.activeElement !== range) range.value = settings.privateEquityPct;
      bar.querySelector('.lctc-pct-label').textContent = settings.privateEquityPct + '%';
      bar.classList.toggle('lctc-off', !settings.enabled);
    }
  }

  function ensureBar(table, info) {
    const thead = table.tHead;
    if (!thead) return;
    let row = [...thead.rows].find((r) => r.classList.contains('lctc-bar-row'));
    if (row && row === thead.lastElementChild && row.cells[0].colSpan === info.colCount) return;
    if (row) row.remove();
    thead.appendChild(buildBar(info.colCount));
    syncBars();
  }

  /** { slug, name } for the company a row belongs to. */
  function rowCompany(row, cells) {
    for (const a of row.querySelectorAll('a[href*="/companies/"]')) {
      const m = a.getAttribute('href').match(/\/companies\/([^/?#]+)/);
      if (m) {
        const slug = m[1].toLowerCase();
        const name = textOf(a).split('\n').map((t) => t.trim()).find(Boolean);
        return { slug, name: name || slug };
      }
    }
    const p = location.pathname.match(/^\/companies\/([^/?#]+)/);
    if (p) {
      const slug = p[1].toLowerCase();
      return { slug, name: pageCompanyName(slug) || slug };
    }
    // Multi-company pages without links: use the first line of the first cell.
    const first = textOf(cells.find(Boolean)).split('\n').map((t) => t.trim()).find(Boolean);
    const slug = L.slugify(first);
    return slug && !/^\d/.test(slug) ? { slug, name: first } : null;
  }

  /** First text node in the cell that contains a number = the headline TC. */
  function findTotalNode(cell) {
    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (/\d/.test(n.nodeValue)) return n;
    }
    return null;
  }

  // ---------- apply / restore ----------

  function decorate(el, cls, title) {
    if (!decorated.has(el)) decorated.set(el, el.getAttribute('title'));
    el.classList.remove('lctc-public', 'lctc-private', 'lctc-unknown');
    if (cls) el.classList.add(cls);
    if (title != null) el.setAttribute('title', title);
  }

  function processTable(table) {
    const info = analyzeTable(table);
    if (!info) return;
    ensureBar(table, info);
    if (!settings.enabled) return;
    if (info.headCell && !decorated.has(info.headCell)) {
      decorate(info.headCell, null, 'Showing liquid TC (public stock counts, private equity at your slider %) — Levels.fyi Liquid TC extension');
      info.headCell.classList.add('lctc-th');
    }

    for (const body of table.tBodies) {
      for (const row of body.rows) {
        const cells = cellsByCol(row);
        const tcCell = cells[info.totalCol];
        if (!tcCell) continue;
        const node = findTotalNode(tcCell);
        if (!node) continue;

        const co = rowCompany(row, cells);
        if (!co) continue;
        rewriteValue(node, tcCell, co, () =>
          info.stockCol >= 0
            ? L.parseMoney(textOf(cells[info.stockCol]))
            : L.stockFromBreakdown(textOf(tcCell), info.order)
        );
      }
    }
  }

  /**
   * Replace the TC number in `node` with liquid TC.
   * getStock() -> annual stock, 0 if none, null if it couldn't be read.
   */
  function rewriteValue(node, decorateEl, co, getStock) {
    const rec = records.get(node);
    const orig = rec && node.nodeValue === rec.applied ? rec.orig : node.nodeValue;
    const total = L.parseMoney(orig);
    if (total == null) return;
    const restore = (reason) => {
      if (rec && node.nodeValue === rec.applied) node.nodeValue = rec.orig;
      records.delete(node);
      decorate(decorateEl, 'lctc-unknown', `Liquid TC: ${reason}. Showing original TC.`);
    };

    const status = statusFor(co.slug, co.name);
    if (status.type === 'unknown') return restore(`unknown if ${co.name || co.slug} is public (${status.reason})`);

    let stock = getStock();
    if (stock == null) {
      // Public: stock counts at 100% anyway, so the total is right without it.
      if (status.type === 'private') return restore("couldn't read the stock amount for this private company");
      stock = 0;
    }

    const pct = settings.privateEquityPct;
    const liquid = L.liquidTotal(total, stock, status.type, pct);
    const text = L.formatMoney(liquid, L.describeFormat(orig));
    if (node.nodeValue !== text) node.nodeValue = text;
    records.set(node, { orig, applied: text });

    const fmt = (v) => L.formatMoney(v, { lead: '', prefix: '$', commas: true, space: '', suffix: '', rest: '' });
    const how =
      status.type === 'public'
        ? 'Public company: stock can be sold, so it counts at 100%.'
        : `Private company: illiquid stock counted at ${pct}%.`;
    decorate(
      decorateEl,
      'lctc-' + status.type,
      `Liquid TC: ${fmt(liquid)}\nOriginal TC: ${orig.trim()}\nStock/yr: ${fmt(stock)}\n${how}\nWhy ${status.type}: ${status.reason}`
    );
  }

  // ---------- entry detail panel ("Average Annual Total Comp" / "Average Annual Stock") ----------

  const DETAIL_TOTAL_RE = /^\s*average annual total comp/i;
  const DETAIL_STOCK_RE = /^\s*average annual stock/i;
  const MONEY_ONLY_RE = /^\s*[^\d\s]{0,4}\s?\d[\d,]*(?:\.\d+)?\s*[KkMm]?\s*$/;

  function findTextNode(root, re) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) if (re.test(n.nodeValue)) return n;
    return null;
  }

  /** First text node after `from` (inside `root`) that is just a money amount. */
  function nextMoneyNode(root, from) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    w.currentNode = from;
    let n;
    while ((n = w.nextNode())) if (MONEY_ONLY_RE.test(n.nodeValue)) return n;
    return null;
  }

  function detailCompany(container) {
    let el = container;
    for (let i = 0; el && i < 5; i++, el = el.parentElement) {
      const a = el.querySelector('a[href*="/companies/"]');
      const m = a && a.getAttribute('href').match(/\/companies\/([^/?#]+)/);
      if (m) {
        const name = textOf(a).split('\n').map((t) => t.trim()).find(Boolean);
        return { slug: m[1].toLowerCase(), name: name || m[1] };
      }
    }
    const p = location.pathname.match(/^\/companies\/([^/?#]+)/);
    if (p) return { slug: p[1].toLowerCase(), name: pageCompanyName(p[1].toLowerCase()) || p[1] };
    // Fall back to the panel heading: first line of the nearest ancestor with a few lines of text.
    el = container;
    for (let i = 0; el && i < 6; i++, el = el.parentElement) {
      const first = textOf(el).split('\n').map((t) => t.trim()).find(Boolean);
      if (first && !DETAIL_TOTAL_RE.test(first) && !/\d/.test(first)) return { slug: L.slugify(first), name: first };
    }
    return null;
  }

  function processDetailPanels() {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const labels = [];
    let n;
    while ((n = w.nextNode())) if (DETAIL_TOTAL_RE.test(n.nodeValue)) labels.push(n);

    for (const label of labels) {
      // Smallest ancestor that also holds the stock line.
      let container = label.parentElement;
      for (let i = 0; container && i < 8 && !/average annual stock/i.test(container.textContent); i++) {
        container = container.parentElement;
      }
      if (!container || !/average annual stock/i.test(container.textContent)) continue;

      const valueNode = nextMoneyNode(container, label);
      if (!valueNode || !valueNode.parentElement) continue;
      const co = detailCompany(container);
      if (!co || !co.slug) continue;

      const el = valueNode.parentElement;
      el.classList.add('lctc-detail');
      rewriteValue(valueNode, el, co, () => {
        const stockLabel = findTextNode(container, DETAIL_STOCK_RE);
        if (!stockLabel) return 0; // no stock section = no equity
        const stockNode = nextMoneyNode(container, stockLabel);
        return stockNode ? L.parseMoney(stockNode.nodeValue) : null;
      });
    }
  }

  function restoreAll() {
    for (const [node, rec] of records) {
      if (node.isConnected && node.nodeValue === rec.applied) node.nodeValue = rec.orig;
    }
    records.clear();
    for (const [el, title] of decorated) {
      el.classList.remove('lctc-public', 'lctc-private', 'lctc-unknown', 'lctc-th', 'lctc-detail');
      if (title == null) el.removeAttribute('title');
      else el.setAttribute('title', title);
    }
    decorated.clear();
  }

  function processAll() {
    if (!settings.enabled) restoreAll();
    // Drop references to nodes React has removed.
    for (const node of records.keys()) if (!node.isConnected) records.delete(node);
    for (const el of decorated.keys()) if (!el.isConnected) decorated.delete(el);
    document.querySelectorAll('table').forEach(processTable);
    if (settings.enabled) processDetailPanels();
  }

  let processTimer = null;
  function scheduleProcess() {
    clearTimeout(processTimer);
    processTimer = setTimeout(processAll, 250);
  }

  // ---------- boot ----------

  async function init() {
    const [sync, local] = await Promise.all([
      chrome.storage.sync.get(DEFAULTS),
      chrome.storage.local.get({ [CACHE_KEY]: {} }),
    ]);
    settings = { ...DEFAULTS, ...sync };
    seen = local[CACHE_KEY] || {};
    loadSecIndex(false);

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync') {
        for (const [k, { newValue }] of Object.entries(changes)) settings[k] = newValue ?? DEFAULTS[k];
        syncBars();
        scheduleProcess();
      } else if (area === 'local' && changes.secIndexV5 && changes.secIndexV5.newValue) {
        loadSecIndex(false); // SEC list refreshed (e.g. from the popup)
      }
    });

    // Always observe: the control bar must be (re)inserted even while disabled.
    new MutationObserver(scheduleProcess).observe(document.body, { childList: true, subtree: true, characterData: true });

    processAll();
  }

  init();
})();
