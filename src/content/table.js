// Salary tables: find the TC / stock columns and rewrite each row.
(() => {
  'use strict';
  const L = self.LCTC;
  const U = L.ui;
  const S = U.state;
  const { decorated } = S;

  function analyzeTable(table) {
    const headRows = table.tHead ? [...table.tHead.rows].filter((r) => !r.classList.contains('lctc-bar-row')) : [];
    const headRow = headRows[headRows.length - 1];
    if (!headRow) return null;
    const heads = U.cellsByCol(headRow);
    let totalCol = -1;
    let stockCol = -1;
    let order = null;
    heads.forEach((th, i) => {
      if (!th) return;
      const t = U.norm(U.textOf(th));
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

  /** { slug, name } for the company a row belongs to. */
  function rowCompany(row, cells) {
    for (const a of row.querySelectorAll('a[href*="/companies/"]')) {
      const m = a.getAttribute('href').match(/\/companies\/([^/?#]+)/);
      if (m) {
        const slug = m[1].toLowerCase();
        const name = U.textOf(a).split('\n').map((t) => t.trim()).find(Boolean);
        return { slug, name: name || slug };
      }
    }
    const p = location.pathname.match(/^\/companies\/([^/?#]+)/);
    if (p) {
      const slug = p[1].toLowerCase();
      return { slug, name: U.pageCompanyName(slug) || slug };
    }
    // Multi-company pages without links: use the first line of the first cell.
    const first = U.textOf(cells.find(Boolean)).split('\n').map((t) => t.trim()).find(Boolean);
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

  function processTable(table) {
    const info = analyzeTable(table);
    if (!info) return;
    U.ensureBar(table, info);
    if (!U.isActive()) return;
    if (info.headCell && !decorated.has(info.headCell)) {
      U.decorate(info.headCell, null, 'Showing liquid TC (public stock counts, private equity at your slider %s) — Levels.fyi Liquid TC extension');
      info.headCell.classList.add('lctc-th');
    }

    for (const body of table.tBodies) {
      for (const row of body.rows) {
        const cells = U.cellsByCol(row);
        const tcCell = cells[info.totalCol];
        if (!tcCell) continue;
        const node = findTotalNode(tcCell);
        if (!node) continue;

        const co = rowCompany(row, cells);
        if (!co) continue;
        U.rewriteValue(node, tcCell, co, () =>
          info.stockCol >= 0
            ? L.parseMoney(U.textOf(cells[info.stockCol]))
            : L.stockFromBreakdown(U.textOf(tcCell), info.order)
        );
      }
    }
  }

  Object.assign(U, { processTable });
})();
