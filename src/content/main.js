// Orchestration: restore / process passes, scheduling and boot.
(() => {
  'use strict';
  const L = self.LCTC;
  const U = L.ui;
  const S = U.state;
  const { records, decorated, footers } = S;
  const { DEFAULTS } = U;

  function restoreAll() {
    for (const [node, rec] of records) {
      if (node.isConnected && node.nodeValue === rec.applied) node.nodeValue = rec.orig;
    }
    records.clear();
    for (const [el, title] of decorated) {
      el.classList.remove('lctc-public', 'lctc-private', 'lctc-liquid', 'lctc-unknown', 'lctc-th', 'lctc-detail');
      if (title == null) el.removeAttribute('title');
      else el.setAttribute('title', title);
    }
    decorated.clear();
    for (const f of footers) f.remove();
    footers.clear();
  }

  function processAll() {
    if (!U.isActive()) restoreAll();
    // Drop references to nodes React has removed.
    for (const f of footers) if (!f.isConnected) footers.delete(f);
    for (const node of records.keys()) if (!node.isConnected) records.delete(node);
    for (const el of decorated.keys()) if (!el.isConnected) decorated.delete(el);
    document.querySelectorAll('table').forEach(U.processTable);
    if (U.isActive()) {
      U.processDetailPanels();
      U.processTenderPanels();
    }
    U.processOverview();
  }

  let processTimer = null;
  function scheduleProcess() {
    clearTimeout(processTimer);
    processTimer = setTimeout(processAll, 250);
  }

  async function init() {
    S.settings = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
    U.loadSecIndex(false);

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync') {
        for (const [k, { newValue }] of Object.entries(changes)) S.settings[k] = newValue ?? DEFAULTS[k];
        U.syncBars();
        scheduleProcess();
      } else if (area === 'local' && changes.secIndexV5 && changes.secIndexV5.newValue) {
        U.loadSecIndex(false); // SEC list refreshed (e.g. from the popup)
      }
    });

    // Always observe: the bar must be (re)inserted while only the bar toggle is off, and everything
    // must come back when the popup master switch is turned on.
    new MutationObserver(scheduleProcess).observe(document.body, { childList: true, subtree: true, characterData: true });

    processAll();
  }

  Object.assign(U, { restoreAll, processAll, scheduleProcess });

  init();
})();
