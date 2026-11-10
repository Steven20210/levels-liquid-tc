// DOM helpers shared by the content modules.
(() => {
  'use strict';
  const L = self.LCTC;
  const U = L.ui;
  const S = U.state;
  const { decorated, records } = S;

  function pageCompanyName(slug) {
    try {
      const c = JSON.parse(document.getElementById('__NEXT_DATA__').textContent)?.props?.pageProps?.company;
      return c && c.slug === slug ? c.name : null;
    } catch (_) {
      return null;
    }
  }

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

  function decorate(el, cls, title) {
    if (!decorated.has(el)) decorated.set(el, el.getAttribute('title'));
    el.classList.remove('lctc-public', 'lctc-private', 'lctc-liquid', 'lctc-unknown');
    if (cls) el.classList.add(cls);
    if (title != null) el.setAttribute('title', title);
  }

  const MONEY_ONLY_RE = /^\s*[^\d\s]{0,4}\s?\d[\d,]*(?:\.\d+)?\s*[KkMm]?\s*$/;

  function findTextNode(root, re) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) if (re.test(n.nodeValue)) return n;
    return null;
  }

  /** A value node: just a money amount, or one we already rewrote (its text no longer looks like money). */
  function isMoneyNode(n) {
    if (MONEY_ONLY_RE.test(n.nodeValue)) return true;
    const rec = records.get(n);
    return !!rec && rec.applied === n.nodeValue;
  }

  /** First text node after `from` (inside `root`) that is a value (see isMoneyNode). */
  function nextMoneyNode(root, from) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    w.currentNode = from;
    let n;
    while ((n = w.nextNode())) if (isMoneyNode(n)) return n;
    return null;
  }

  /**
   * Labels matched on an element's whole text, not a single text node: levels.fyi (React) can
   * split "Average Annual" / "Total Comp" into several nodes. Returns [{ el, node }] where `el` is
   * the smallest short element whose text matches `re` (tested lowercase, whitespace collapsed).
   * The element may include its own value (a whole row); `node` skips money-only text nodes so
   * the value that follows the label is still found next.
   * and `node` is its last text node, so nextMoneyNode(root, node) continues right after the label.
   */
  function findLabels(root, re) {
    const out = [];
    const done = new Set();
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      let el = n.parentElement;
      for (let i = 0; el && el !== root && i < 3; i++, el = el.parentElement) {
        if (done.has(el)) break;
        const t = norm(el.textContent);
        if (t.length > 60) break; // grew past the label into surrounding content
        if (!re.test(t)) continue;
        done.add(el);
        const lw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let last = null;
        while (lw.nextNode()) if (!isMoneyNode(lw.currentNode)) last = lw.currentNode; // label text, not its value
        if (last) out.push({ el, node: last });
        break;
      }
    }
    return out;
  }

  /** First label for `re` (see findLabels), falling back to a single text node that matches it. */
  function findLabel(root, re) {
    const [hit] = findLabels(root, re);
    if (hit) return hit;
    const node = findTextNode(root, new RegExp(re.source.replace(/^\^/, '^\s*'), 'i'));
    return node ? { el: node.parentElement, node } : null;
  }

  Object.assign(U, { norm, textOf, findTextNode, findLabels, findLabel, nextMoneyNode, cellsByCol, pageCompanyName, decorate });
})();
