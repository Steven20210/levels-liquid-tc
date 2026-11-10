// Replaces one TC number with liquid TC and decorates its element.
(() => {
  'use strict';
  const L = self.LCTC;
  const U = L.ui;
  const S = U.state;
  const { records } = S;

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
      U.decorate(decorateEl, 'lctc-unknown', `Liquid TC: ${reason}. Showing original TC.`);
    };

    const status = U.statusFor(co.slug, co.name);
    if (status.type === 'unknown') return restore(`unknown if ${co.name || co.slug} is public (${status.reason})`);

    let stock = getStock();
    if (stock == null) {
      // Public: stock counts at 100% anyway, so the total is right without it.
      if (status.type !== 'public') return restore("couldn't read the stock amount for this private company");
      stock = 0;
    }

    const pct = S.settings.privateEquityPct; // one slider for both private and private-with-tenders
    const liquid = L.liquidTotal(total, stock, status.type, pct);
    const text = L.formatMoney(liquid, L.describeFormat(orig));
    if (node.nodeValue !== text) node.nodeValue = text;
    records.set(node, { orig, applied: text });

    const fmt = (v) => L.formatMoney(v, { lead: '', prefix: '$', commas: true, space: '', suffix: '', rest: '' });
    const how =
      status.type === 'public'
        ? 'Public company: stock can be sold, so it counts at 100%.'
        : status.type === 'liquid'
          ? `Private company with regular tender offers/buybacks: stock counted at ${pct}%.`
          : `Private company: illiquid stock counted at ${pct}%.`;
    U.decorate(
      decorateEl,
      'lctc-' + status.type,
      `Liquid TC: ${fmt(liquid)}\nOriginal TC: ${orig.trim()}\nStock/yr: ${fmt(stock)}\n${how}\nWhy ${status.type}: ${status.reason}`
    );
    return { type: status.type, reason: status.reason, evidence: status.evidence, orig, liquid, stock, pct };
  }

  Object.assign(U, { rewriteValue });
})();
