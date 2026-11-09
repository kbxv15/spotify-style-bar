// Runs in the extension's isolated world. Turns the popup's settings into
// attributes on <html> that the stylesheet and layout script read, and passes
// along the tab's zoom level for "true size".
(() => {
  const DEFAULTS = { enabled: true, colors: true, trueSize: true, dislike: false, menu: true, details: true, artOnly: true, immersive: true, overlay: true };
  const html = document.documentElement;

  function applySettings(s) {
    html.setAttribute('data-spotbar', s.enabled ? 'on' : 'off');
    html.setAttribute('data-spotbar-colors', s.colors ? 'on' : 'off');
    html.setAttribute('data-spotbar-truesize', s.trueSize ? 'on' : 'off');
    html.setAttribute('data-spotbar-dislike', s.dislike ? 'on' : 'off');
    html.setAttribute('data-spotbar-menu', s.menu ? 'on' : 'off');
    html.setAttribute('data-spotbar-details', s.details ? 'on' : 'off');
    html.setAttribute('data-spotbar-artonly', s.artOnly ? 'on' : 'off');
    html.setAttribute('data-spotbar-immersive', s.immersive ? 'on' : 'off');
    html.setAttribute('data-sbi-overlay', s.overlay ? 'on' : 'off');
  }
  applySettings(DEFAULTS);
  chrome.storage.sync.get(DEFAULTS, applySettings);
  chrome.storage.onChanged.addListener((_changes, area) => {
    if (area === 'sync') chrome.storage.sync.get(DEFAULTS, applySettings);
  });

  // Page zoom → --spotbar-scale. Kept in our own <style> so the page can't wipe it.
  const scaleStyle = document.createElement('style');
  scaleStyle.id = 'spotbar-scale';
  html.appendChild(scaleStyle);
  function setZoom(zoom) {
    if (!(zoom > 0)) return;
    scaleStyle.textContent = `:root { --spotbar-scale: ${(1 / zoom).toFixed(4)}; }`;
  }
  chrome.runtime.sendMessage({ type: 'spotbar:getZoom' }, (res) => {
    void chrome.runtime.lastError;
    if (res) setZoom(res.zoom);
  });
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'spotbar:zoom') setZoom(msg.zoom);
  });
})();
