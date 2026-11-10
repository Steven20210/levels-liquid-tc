// In-page control bar under the table header (toggle + private-equity slider).
(() => {
  'use strict';
  const L = self.LCTC;
  const U = L.ui;
  const S = U.state;

  // ---------- in-page control bar (sits right under the grey table header) ----------

  function buildBar(colCount) {
    const tr = document.createElement('tr');
    tr.className = 'lctc-bar-row';
    const td = document.createElement('td');
    td.colSpan = colCount;
    td.innerHTML = `
      <div class="lctc-bar">
        <label class="lctc-toggle" title="Replace TC with liquid TC: public stock counts (it can be sold), private equity counts at the slider %s">
          <input type="checkbox" class="lctc-enabled" />
          <span class="lctc-switch"></span>
          <span>Liquid TC</span>
        </label>
        <label class="lctc-slider" title="How much illiquid private-company stock is worth to you">
          <span>Private equity at <b class="lctc-pct-label" data-key="privateEquityPct"></b></span>
          <input type="range" class="lctc-pct" data-key="privateEquityPct" min="0" max="100" step="5" />
        </label>
        <span class="lctc-legend">
          <i class="lctc-dot lctc-dot-private"></i>private
          <i class="lctc-dot lctc-dot-liquid"></i>private with previous tenders
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
    for (const range of td.querySelectorAll('.lctc-pct')) {
      const key = range.dataset.key;
      range.addEventListener('input', () => {
        // Live preview while dragging; persisted on release.
        S.settings[key] = Number(range.value);
        syncBars();
        U.scheduleProcess();
      });
      range.addEventListener('change', () => {
        chrome.storage.sync.set({ [key]: Number(range.value) });
      });
    }
    return tr;
  }

  function syncBars() {
    for (const bar of document.querySelectorAll('.lctc-bar')) {
      const cb = bar.querySelector('.lctc-enabled');
      if (cb.checked !== !!S.settings.enabled) cb.checked = !!S.settings.enabled;
      for (const range of bar.querySelectorAll('.lctc-pct')) {
        if (document.activeElement !== range) range.value = S.settings[range.dataset.key];
      }
      for (const label of bar.querySelectorAll('.lctc-pct-label')) {
        label.textContent = S.settings[label.dataset.key] + '%';
      }
      bar.classList.toggle('lctc-off', !S.settings.enabled);
    }
  }

  function ensureBar(table, info) {
    const thead = table.tHead;
    if (!thead) return;
    let row = [...thead.rows].find((r) => r.classList.contains('lctc-bar-row'));
    if (!S.settings.extensionOn) {
      // Popup master switch off: leave no trace on the page.
      if (row) row.remove();
      return;
    }
    if (row && row === thead.lastElementChild && row.cells[0].colSpan === info.colCount) return;
    if (row) row.remove();
    thead.appendChild(buildBar(info.colCount));
    syncBars();
  }

  Object.assign(U, { syncBars, ensureBar });
})();
