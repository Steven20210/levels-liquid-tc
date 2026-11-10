const toggle = document.getElementById('enabled');

chrome.storage.sync.get({ extensionOn: true }).then((s) => {
  toggle.checked = !!s.extensionOn;
});

// Master switch: off removes everything from levels.fyi, including the control bar.
toggle.addEventListener('change', () => chrome.storage.sync.set({ extensionOn: toggle.checked }));
