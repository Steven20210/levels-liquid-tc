// "Previous tenders" block in expanded entry panels.
(() => {
  'use strict';
  const L = self.LCTC;
  const U = L.ui;
  const S = U.state;
  const { footers } = S;

  function removeFooter(container) {
    const f = container.querySelector(':scope > .lctc-footer');
    if (f) {
      f.remove();
      footers.delete(f);
    }
    removeTender(container);
  }

  function removeTender(container) {
    for (const t of container.querySelectorAll('.lctc-tender')) {
      t.remove();
      footers.delete(t);
    }
  }

  /**
   * The "BONUS" block in the detail panel: the heading plus its rows ("Average Annual Bonuses",
   * "Sign On Bonus", ...), i.e. the largest ancestor of the bonus label, below `container`, whose
   * text starts with "bonus". The tender block goes after it, never inside a label/value row.
   */
  function findBonusSection(container) {
    const label = U.findLabel(container, /^average annual bonus/);
    if (!label) return null;
    let section = null;
    for (let el = label.el; el && el !== container; el = el.parentElement) {
      if (/^bonus/.test(U.norm(el.textContent))) section = el;
      else if (section) break;
    }
    // No BONUS heading: at least go after the label's whole row.
    const row = label.el.parentElement;
    return section || (row && row !== container && container.contains(row) ? row : null);
  }

  /** "Employee tenders" section (liquid companies only), placed right under the Bonus block. */
  function renderTender(container, model) {
    const ev = model.evidence;
    let t = container.querySelector('.lctc-tender');
    if (!ev) return removeTender(container);
    const sig = model.sig;
    if (t && t.dataset.sig === sig) return; // avoids a MutationObserver loop
    if (!t) {
      t = document.createElement('div');
      t.className = 'lctc-tender';
      for (const e of ['click', 'mousedown', 'pointerdown', 'keydown']) {
        t.addEventListener(e, (x) => x.stopPropagation());
      }
      const bonus = findBonusSection(container);
      if (bonus) bonus.insertAdjacentElement('afterend', t);
      else container.appendChild(t);
      footers.add(t);
    }
    t.dataset.sig = sig;
    fillTender(t, ev);
  }

  /** Fills a tender block: "Previous tenders" title, what happened, and its sources. */
  function fillTender(t, ev) {
    t.textContent = '';
    const add = (cls, text) => {
      const d = document.createElement('div');
      d.className = cls;
      d.textContent = text;
      t.appendChild(d);
      return d;
    };
    add('lctc-tender-head', 'Previous tenders');
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const bold = (parent, text) => {
      const b = document.createElement('b');
      b.textContent = text;
      parent.appendChild(b);
    };
    // "yearly tenders: Mar 2023 ($50B), Feb 2024 ($65B)" -> bold "Yearly tenders:" + one line per event.
    const note = add('lctc-tender-note', '');
    const m = ev.note.match(/^([^:()]{1,40}):\s+(.*)$/);
    const body = m ? m[2] : ev.note;
    if (m) {
      bold(note, cap(m[1]) + ':');
    }
    const events = body.split(/,\s+(?=[A-Z][a-z]{2}\s\d{4})/);
    if (m && events.length > 1) {
      const ul = document.createElement('ul');
      ul.className = 'lctc-tender-list';
      for (const e of events) {
        const li = document.createElement('li');
        li.textContent = e;
        ul.appendChild(li);
      }
      note.appendChild(ul);
    } else {
      note.append((m ? ' ' : '') + (m ? body : cap(body)));
    }
    const conf = add('lctc-tender-meta', '');
    bold(conf, 'Confidence:');
    conf.append(' ' + cap(ev.tierLabel));
    if (ev.sources.length) {
      const d = add('lctc-tender-meta', '');
      bold(d, 'Sources:');
      d.append(' ');
      ev.sources.forEach((u, i) => {
        const a = document.createElement('a');
        a.href = u;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = new URL(u).hostname.replace(/^www\./, '');
        if (i) d.append(', ');
        d.appendChild(a);
      });
    }
  }

  /** { note, tierLabel, sources } to display for a liquid status (https links only). */
  function tenderEvidence(status) {
    const e = status.evidence;
    return { note: e.note, tierLabel: e.tierLabel, sources: (e.sources || []).filter((u) => /^https:\/\//.test(u)) };
  }

  /** Adds/updates the tender section in the expanded entry panel (no footer any more). */
  function renderFooter(container, info) {
    if (/^(TABLE|THEAD|TBODY|TR)$/.test(container.tagName)) return; // can't hold a <div>
    renderTender(container, L.footerModel(info));
  }

  Object.assign(U, { removeFooter, renderTender, fillTender, renderFooter, tenderEvidence });
})();
