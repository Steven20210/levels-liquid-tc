// Expanded entry panels ("Average Annual Total Comp" / "Comp Breakdown").
(() => {
  'use strict';
  const L = self.LCTC;
  const U = L.ui;
  const { records } = U.state;

  // Matched against lowercase, whitespace-collapsed element text (see U.findLabels).
  const DETAIL_TOTAL_RE = /^average annual total comp/;
  const DETAIL_STOCK_RE = /^average annual stock/;
  const CALC_STOCK_RE = /^stock\s*\/\s*yr/; // "Stock / yr" in the "See Calculation" card

  /**
   * The "See Calculation" card lists Base / Stock / Bonus under the headline total. Show the stock
   * the way we count it (slider % x grant) so the lines add up to the liquid headline. Only this
   * card changes; "Comp Breakdown" below keeps the real grant. The card only exists while it's open.
   */
  function rewriteCalcStock(container, info) {
    const label = U.findLabel(container, CALC_STOCK_RE);
    const node = label && U.nextMoneyNode(container, label.node);
    if (!node || !node.parentElement) return;
    const rec = records.get(node);
    const orig = rec && node.nodeValue === rec.applied ? rec.orig : node.nodeValue;
    const full = L.parseMoney(orig);
    if (full == null) return;
    const pct = info.type === 'public' ? 100 : info.pct;
    // "75% × US$160,000 = US$120,000": share counted x grant = what goes into the headline.
    const counted = L.formatMoney(full * (pct / 100), L.describeFormat(orig));
    const text = `${pct}% × ${orig.trim()} = ${counted}`;
    if (node.nodeValue !== text) node.nodeValue = text;
    records.set(node, { orig, applied: text });
    U.decorate(
      node.parentElement,
      null,
      pct === 100
        ? 'Public stock can be sold, so it counts in full.'
        : `Private equity counted at ${pct}% (the slider: how much it's worth to you) of the ${orig.trim()}/yr grant.`
    );
  }

  function detailCompany(container) {
    let el = container;
    for (let i = 0; el && i < 5; i++, el = el.parentElement) {
      const a = el.querySelector('a[href*="/companies/"]');
      const m = a && a.getAttribute('href').match(/\/companies\/([^/?#]+)/);
      if (m) {
        const name = U.textOf(a).split('\n').map((t) => t.trim()).find(Boolean);
        return { slug: m[1].toLowerCase(), name: name || m[1] };
      }
    }
    const p = location.pathname.match(/^\/companies\/([^/?#]+)/);
    if (p) return { slug: p[1].toLowerCase(), name: U.pageCompanyName(p[1].toLowerCase()) || p[1] };
    // Fall back to the panel heading: first line of the nearest ancestor with a few lines of text.
    el = container;
    for (let i = 0; el && i < 6; i++, el = el.parentElement) {
      const first = U.textOf(el).split('\n').map((t) => t.trim()).find(Boolean);
      if (first && !DETAIL_TOTAL_RE.test(U.norm(first)) && !/\d/.test(first)) return { slug: L.slugify(first), name: first };
    }
    return null;
  }

  function processDetailPanels() {
    for (const label of U.findLabels(document.body, DETAIL_TOTAL_RE)) {
      // Smallest ancestor that also holds the stock line.
      let container = label.el.parentElement;
      for (let i = 0; container && i < 8 && !/average annual stock/i.test(container.textContent); i++) {
        container = container.parentElement;
      }
      if (!container || !/average annual stock/i.test(container.textContent)) continue;

      const valueNode = U.nextMoneyNode(container, label.node);
      if (!valueNode || !valueNode.parentElement) continue;
      const co = detailCompany(container);
      if (!co || !co.slug) continue;

      const el = valueNode.parentElement;
      el.classList.add('lctc-detail');
      const info = U.rewriteValue(valueNode, el, co, () => {
        const stockLabel = U.findLabel(container, DETAIL_STOCK_RE);
        if (!stockLabel) return 0; // no stock section = no equity
        const stockNode = U.nextMoneyNode(container, stockLabel.node);
        return stockNode ? L.parseMoney(stockNode.nodeValue) : null;
      });
      if (info) {
        rewriteCalcStock(container, info);
        U.renderFooter(container, info);
      } else {
        U.removeFooter(container); // unknown company / unreadable stock: show nothing
      }
    }
  }

  /**
   * Fallback that doesn't depend on the total-comp label: any expanded entry panel (found by its
   * "Comp Breakdown" heading) for a liquid company gets its "Previous tenders" block.
   */
  function processTenderPanels() {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (!/^\s*comp breakdown\s*$/i.test(n.nodeValue)) continue;
      // Smallest ancestor that also holds the company link (the whole panel).
      let container = n.parentElement;
      for (let i = 0; container && i < 10 && !container.querySelector('a[href*="/companies/"]'); i++) {
        container = container.parentElement;
      }
      if (!container || container === document.body || /^(TABLE|THEAD|TBODY|TR)$/.test(container.tagName)) continue;
      if (container.querySelector('.lctc-tender')) continue; // main path already handled it
      const co = detailCompany(container);
      if (!co || !co.slug) continue;
      const status = U.statusFor(co.slug, co.name);
      if (status.type !== 'liquid' || !status.evidence) continue;
      const ev = U.tenderEvidence(status);
      U.renderTender(container, { evidence: ev, sig: JSON.stringify(['tender-only', co.slug, ev]) });
    }
  }

  Object.assign(U, { processDetailPanels, processTenderPanels });
})();
