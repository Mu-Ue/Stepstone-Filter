// ===========================================================================
// Stepstone Filter — Background Service Worker
// ===========================================================================
// This single-file service worker handles two responsibilities:
//
//  1. Opens the options page when the user clicks the toolbar icon.
//  2. Listens for auto-close requests from the content script and closes
//     the offending tab (chrome.tabs.remove does NOT require the "tabs"
//     permission per Chrome docs).
// ===========================================================================

(() => {
  'use strict';

  // --- Toolbar icon → Options page ------------------------------------------
  chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage();
  });

  // --- Auto-close message handler -------------------------------------------
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Guard: only act on our own protocol messages from a valid tab context.
    if (
      !message ||
      message.type !== 'ssf-close-applied-tab' ||
      !sender.tab ||
      !sender.tab.id
    ) {
      return false;
    }

    chrome.tabs.remove(sender.tab.id);
    sendResponse({ closed: true });
    return false; // do not keep the port open for async response
  });
})();
