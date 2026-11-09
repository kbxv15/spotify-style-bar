// Tells YouTube Music tabs their page zoom so the bar can keep Spotify's real size.
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg && msg.type === 'spotbar:getZoom' && sender.tab) {
    chrome.tabs.getZoom(sender.tab.id).then((zoom) => reply({ zoom }), () => reply({ zoom: 1 }));
    return true;
  }
  return false;
});

chrome.tabs.onZoomChange.addListener(({ tabId, newZoomFactor }) => {
  chrome.tabs.sendMessage(tabId, { type: 'spotbar:zoom', zoom: newZoomFactor }).catch(() => {});
});
