const DEFAULTS = { enabled: false, privateEquityPct: 0, overrides: {} };
const $ = (id) => document.getElementById(id);

let overrides = {};

async function load() {
  const s = await chrome.storage.sync.get(DEFAULTS);
  overrides = s.overrides || {};
  $('enabled').checked = !!s.enabled;
  $('pct').value = s.privateEquityPct;
  $('pctLabel').textContent = s.privateEquityPct + '%';
  await renderCompanies();
}

async function renderCompanies() {
  const { companies = {} } = await chrome.storage.local.get('companies');
  const list = $('companies');
  list.textContent = '';
  const entries = Object.entries(companies)
    .sort((a, b) => (b[1].lastSeen || b[1].ts || 0) - (a[1].lastSeen || a[1].ts || 0))
    .slice(0, 50);

  if (!entries.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Browse levels.fyi with the toggle on.';
    list.appendChild(li);
    return;
  }

  for (const [slug, info] of entries) {
    const effective = overrides[slug] || info.type;
    const li = document.createElement('li');

    const name = document.createElement('span');
    name.className = 'name';
    name.title = `${slug}: ${info.reason || ''}`;
    const dot = document.createElement('span');
    dot.className = 'dot ' + effective;
    name.append(dot, info.name || slug);

    const sel = document.createElement('select');
    for (const [val, label] of [
      ['', `Auto (${info.type})`],
      ['public', 'Public'],
      ['private', 'Private'],
    ]) {
      const o = document.createElement('option');
      o.value = val;
      o.textContent = label;
      sel.appendChild(o);
    }
    sel.value = overrides[slug] || '';
    sel.addEventListener('change', async () => {
      if (sel.value) overrides[slug] = sel.value;
      else delete overrides[slug];
      await chrome.storage.sync.set({ overrides });
      dot.className = 'dot ' + (sel.value || info.type);
    });

    li.append(name, sel);
    list.appendChild(li);
  }
}

$('enabled').addEventListener('change', (e) => chrome.storage.sync.set({ enabled: e.target.checked }));

$('pct').addEventListener('input', (e) => {
  $('pctLabel').textContent = e.target.value + '%';
});
$('pct').addEventListener('change', (e) =>
  chrome.storage.sync.set({ privateEquityPct: Number(e.target.value) })
);

async function showSecStatus(force) {
  $('secStatus').textContent = force ? 'SEC list: downloading…' : 'SEC list: loading…';
  const res = await chrome.runtime.sendMessage({ type: 'getSecIndex', force });
  $('secStatus').textContent = res && res.ok
    ? `Listings: ${res.count.toLocaleString()} name keys (SEC${res.sources && res.sources.tsx ? ' + TSX' : ''}), updated ${new Date(res.ts).toLocaleString()}` +
      (res.error ? ` (${res.error})` : '')
    : `SEC list unavailable: ${res ? res.error : 'no response'}`;
}

$('refresh').addEventListener('click', () => showSecStatus(true));

load();
showSecStatus(false);
