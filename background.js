// Opens the options page from the toolbar icon.
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

// Closes the current tab when the content script detects an
// auto-close trigger phrase (e.g. "Schon beworben"). chrome.tabs.remove()
// doesn't require the "tabs" permission, so we keep the extension's
// permission footprint minimal.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'ssf-close-applied-tab' && sender.tab && sender.tab.id) {
    chrome.tabs.remove(sender.tab.id);
    return false;
  }

  return false;
});
