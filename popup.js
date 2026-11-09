const DEFAULTS = { enabled: true, colors: true, trueSize: true, dislike: false, menu: true, details: true, artOnly: true, immersive: true, overlay: true };
const sub = document.getElementById('sub');
const sub2 = document.getElementById('sub2');

chrome.storage.sync.get(DEFAULTS, (s) => {
  for (const key of Object.keys(DEFAULTS)) {
    const input = document.getElementById(key);
    input.checked = !!s[key];
    input.addEventListener('change', () => {
      chrome.storage.sync.set({ [key]: input.checked });
      if (key === 'enabled') sub.classList.toggle('off', !input.checked);
      if (key === 'immersive') sub2.classList.toggle('off', !input.checked);
    });
  }
  sub.classList.toggle('off', !s.enabled);
  sub2.classList.toggle('off', !s.immersive);
});
