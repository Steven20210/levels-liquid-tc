// Shared mutable state for the content modules (everything hangs off the `LCTC.ui` namespace).
(() => {
  'use strict';
  const L = self.LCTC;
  const U = (L.ui = L.ui || {});

  // extensionOn = popup master switch (off: nothing on the page, not even the bar).
  // enabled     = the bar's "Liquid TC" toggle (off: no rewriting, but the bar stays to turn it back on).
  U.DEFAULTS = { extensionOn: true, enabled: false, privateEquityPct: 0, liquidEquityPct: 75, overrides: {} };

  U.state = {
    settings: { ...U.DEFAULTS },
    // SEC EDGAR index of listed companies, fetched by the background worker.
    sec: { state: 'loading', index: null, error: null },
    // Text nodes we've rewritten: node -> { orig, applied }
    records: new Map(),
    // Cells/headers we've decorated: el -> original title (or null)
    decorated: new Map(),
    // Tender blocks we've inserted (so they can be removed again).
    footers: new Set(),
  };

  /** True when TC rewriting / tender blocks should show: master switch on AND the bar toggle on. */
  U.isActive = () => !!(U.state.settings.extensionOn && U.state.settings.enabled);
})();
