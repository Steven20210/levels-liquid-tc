// Company overview page: "Previous tenders" block above "About".
(() => {
  'use strict';
  const L = self.LCTC;
  const U = L.ui;
  const S = U.state;
  const { footers } = S;

  /** Company overview page: "Previous tenders" block above the "About" heading. */
  function processOverview() {
    const p = location.pathname.match(/^\/companies\/([^/?#]+)(?:\/overview)?\/?$/);
    let t = document.querySelector('.lctc-overview-tender');
    const drop = () => t && (t.remove(), footers.delete(t));
    if (!p || !U.isActive() || S.sec.state !== 'ready') return drop();
    const slug = p[1].toLowerCase();
    const status = U.statusFor(slug, U.pageCompanyName(slug) || slug);
    if (status.type !== 'liquid' || !status.evidence) return drop();
    const ev = U.tenderEvidence(status);
    const sig = JSON.stringify([slug, ev]);
    if (t && t.dataset.sig === sig && t.isConnected) return;
    // The "About" heading may not be an <h*> tag, so find the text node itself.
    const aboutText = U.findTextNode(document.body, /^\s*about\s*$/i);
    const about = aboutText && aboutText.parentElement;
    if (!about || about.closest('nav, header, footer')) return drop();
    if (!t) {
      t = document.createElement('div');
      t.className = 'lctc-tender lctc-overview-tender';
      footers.add(t);
    }
    t.dataset.sig = sig;
    U.fillTender(t, ev);
    // Reuse the page's own heading element so the title matches "Top Insights"/"About" exactly.
    const head = about.cloneNode(false);
    head.removeAttribute('id');
    head.className = about.className;
    head.textContent = 'Previous tenders';
    t.querySelector('.lctc-tender-head').replaceWith(head);
    about.insertAdjacentElement('beforebegin', t);
  }

  Object.assign(U, { processOverview });
})();
