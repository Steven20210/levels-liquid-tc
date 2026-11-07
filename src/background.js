// Downloads the lists of exchange-listed companies at most once a day and serves a
// name -> ticker index to the content script / popup. Nothing about the user is sent:
// both are static, whole-list downloads that are matched locally.
//
// 1. SEC EDGAR — https://www.sec.gov/files/company_tickers_exchange.json (U.S. SEC, public,
//    no API key): every SEC-registered ticker with its exchange (Nasdaq / NYSE / CBOE / TXSE / OTC).
//    The SEC's fair-access policy rejects requests without a descriptive User-Agent, which
//    fetch() can't set, so rules.json (declarativeNetRequest) sets one for this URL only.
// 2. Toronto Stock Exchange — https://www.tsx.com/json/company-directory/search/tsx/^*
//    (TMX Group, operator of the TSX): the data behind tsx.com's Listed Company Directory.
//    Undocumented, so it's optional: if it fails we keep going with SEC data alone.
importScripts('aliases.js', 'lib.js');

const SEC_URL = 'https://www.sec.gov/files/company_tickers_exchange.json';
const TSX_URL = 'https://www.tsx.com/json/company-directory/search/tsx/%5E*';
const KEY = 'secIndexV5'; // V5: + Toronto Stock Exchange
const MAX_AGE_MS = 24 * 3600 * 1000;
const PARTIAL_MAX_AGE_MS = 3600 * 1000; // retry sooner if the TSX download failed

let inflight = null;

// Drop indexes built by older versions.
chrome.runtime.onInstalled.addListener(() =>
  chrome.storage.local.remove(['secIndex', 'secIndexV2', 'secIndexV3', 'secIndexV4'])
);

async function getJson(url, name) {
  const res = await fetch(url, { cache: 'no-store', credentials: 'omit' });
  if (!res.ok) throw new Error(name + ' returned HTTP ' + res.status);
  return res.json();
}

async function download() {
  const [sec, tsx] = await Promise.allSettled([getJson(SEC_URL, 'SEC'), getJson(TSX_URL, 'TSX')]);
  if (sec.status === 'rejected') throw sec.reason; // SEC is required
  const tsxJson = tsx.status === 'fulfilled' && Array.isArray(tsx.value?.results) ? tsx.value : null;
  const index = self.LCTC.buildSecIndex(sec.value, tsxJson);
  const data = {
    ts: Date.now(),
    count: Object.keys(index).length,
    index,
    sources: { sec: true, tsx: !!tsxJson },
    warning: tsxJson ? null : 'TSX list unavailable (' + (tsx.reason?.message || 'bad response') + '); using SEC only',
  };
  await chrome.storage.local.set({ [KEY]: data });
  return data;
}

async function getIndex(force) {
  const { [KEY]: cached } = await chrome.storage.local.get(KEY);
  const maxAge = cached && cached.sources && !cached.sources.tsx ? PARTIAL_MAX_AGE_MS : MAX_AGE_MS;
  if (!force && cached && Date.now() - cached.ts < maxAge) return withNote(cached);
  if (!inflight) inflight = download().finally(() => (inflight = null));
  try {
    return withNote(await inflight);
  } catch (e) {
    if (cached) return { ...cached, error: 'using cached list; refresh failed: ' + e.message };
    throw e;
  }
}

const withNote = (d) => (d.warning ? { ...d, error: d.warning } : d);

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'getSecIndex') {
    getIndex(msg.force).then(
      (d) => sendResponse({ ok: true, ...d }),
      (e) => sendResponse({ ok: false, error: e.message })
    );
    return true; // async response
  }
});
