// ===========================================================================
// Stepstone Filter — Content Script Entry Point (index.js)
// ===========================================================================
// Bootstrap, initialize, and connect all modules:
//   1. Inject styles into the page once on load.
//   2. Load user settings from chrome.storage.sync.
//   3. Scan existing DOM for job cards and apply filters.
//   4. Wire up a MutationObserver to handle dynamically loaded cards.
//   5. Listen for storage changes (settings updates) and re-scan accordingly.
//   6. Use the Visibility API to pause work when the tab is hidden.
//   7. Periodically check for auto-close triggers on application pages.
// ===========================================================================

import { STYLESHEET_ID, OBSERVER_OPTIONS, MUTATION_DEBOUNCE_MS } from './constants.js';
import { findCards, getTarget }     from './dom-utils.js';
import { processCard, setFilterContext } from './card-processor.js';

/* ---------------------------------------------------------------------------
   1. Style injection (single <style> element).
   --------------------------------------------------------------------------- */

/** Inject the extension's CSS rules into the page head. Idempotent. */
function injectStyles() {
  if (document.getElementById(STYLESHEET_ID)) return;
  const el           = document.createElement('style');
  el.id              = STYLESHEET_ID;
  el.textContent     = `.${'ssf-hidden'}{display:none !important}.${'ssf-debug-outline'}{outline:3px solid #e53e3e !important}`;
  (document.head || document.documentElement).prepend(el);
}

/* ---------------------------------------------------------------------------
   2. MutationObserver — the heart of live DOM monitoring.
   --------------------------------------------------------------------------- */

/** WeakSet tracking cards we have already scanned (auto GC on removal). */
const checkedCards = new WeakSet();

/** Current debounced mutation handler (cleared each call, re-set after delay). */
let mutationHandle   = null;

/** Whether the MutationObserver is currently observing. */
let observer         = null;

/** When true, mutation callbacks are ignored (tab hidden). */
let mutationPaused   = false;

/** Process all cards that have appeared since the last full scan. */
function scanVisiblePage() {
  const nodes       = document.querySelectorAll(
    '.ssf-hidden, .ssf-debug-outline'
  );
  if (nodes.length === 0) return;

  for (let i = 0; i < nodes.length; i++) {
    const node     = nodes[i];
    if (!checkedCards.has(node)) processCard(node, checkedCards);
  }
}

/** Clear the WeakSet and re-scan every card from scratch. */
function resetAndRescan() {
  checkedCards.clear();
  scanFullPage();
}

/** Scan the entire document for job cards that haven't been processed yet. */
function scanFullPage() {
  const cards     = findCards(document, checkedCards);
  for (let i = 0; i < cards.length; i++) processCard(cards[i], checkedCards);
}

/** MutationObserver callback — invoked on each DOM childList mutation. */
function onMutation(mutations) {
  if (mutationPaused) return;

  // Debounce: clear previous handle and set a new one after the delay.
  if (mutationHandle) clearTimeout(mutationHandle);
  mutationHandle   = setTimeout(() => {
    for (let m = 0; m < mutations.length; m++) {
      const mutation   = mutations[m];
      if (mutation.type !== 'childList') continue;

      const addedNodes  = mutation.addedNodes;
      for (let i = 0; i < addedNodes.length; i++) {
        const node          = addedNodes[i];
        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        // Find any new cards within this node's subtree.
        const cardsForNode  = findCards(node, checkedCards);
        for (let c = 0; c < cardsForNode.length; c++) {
          processCard(cardsForNode[c], checkedCards);
        }
      }
    }
    checkAutoClose();
  }, MUTATION_DEBOUNCE_MS);
}

/** Start the MutationObserver on document.documentElement. */
function startObserver() {
  if (observer || !document.documentElement) return;
  observer   = new MutationObserver(onMutation);
  observer.observe(document.documentElement, OBSERVER_OPTIONS);
}

/** Disconnect the current MutationObserver. */
function stopObserver() {
  if (observer) { observer.disconnect(); observer = null; }
}


/* ---------------------------------------------------------------------------
   3. Visibility API — pause processing when tab is hidden.
   --------------------------------------------------------------------------- */

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    mutationPaused   = false;
    scanVisiblePage();
  } else {
    mutationPaused   = true;
  }
});

/* ---------------------------------------------------------------------------
   4. Settings management — load from / push to chrome.storage.sync.
   --------------------------------------------------------------------------- */

/** Load settings, populate filter context, and invoke callback when ready. */
function loadSettings(callback) {
  chrome.storage.sync.get(
    { companies: [], debugMode: false, autoCloseApplied: true },
    (items) => {
      const companies = [];
      const raw       = items.companies || [];
      for (let i = 0; i < raw.length; i++) {
        const v    = String(raw[i]).trim();
        if (v) companies.push(v.toLowerCase());
      }
      setFilterContext(companies, !!items.debugMode);
      callback?.();
    }
  );
}

/** Handle storage.sync changes triggered by the options page. */
function onStorageChanged(changes) {
  if (!changes) return;

  loadSettings(() => {
    if ('autoCloseApplied' in changes) checkAutoClose();
    if ('companies' in changes || 'debugMode' in changes) resetAndRescan();
  });
}

/* ---------------------------------------------------------------------------
   5. Auto-close — detect lingering application confirmation tabs.
   --------------------------------------------------------------------------- */

/** Guard flag: true once we've triggered auto-close on this tab load. */
let appliedCloseTriggered   = false;

function checkAutoClose() {
  const items       = document.querySelectorAll(
    '[data-at="job-item-company-name"], [class*="company"]'
  );
  let triggerFound  = false;

  for (let i = 0; i < items.length; i++) {
    const text   = items[i].textContent.toLowerCase();
    if (text.includes('schon beworben')) { triggerFound   = true; break; }
  }

  // Fallback: scan the entire body text.
  if (!triggerFound) {
    const bodyText   = document.body?.textContent || '';
    if (bodyText.toLowerCase().includes('schon beworben')) triggerFound   = true;
  }

  if (triggerFound && !appliedCloseTriggered) {
    appliedCloseTriggered  = true;
    chrome.runtime.sendMessage(
      { type: 'ssf-close-applied-tab' },
      // Ignore lastError when the service worker has slept.
      () => {}
    );
  }
}

/* ---------------------------------------------------------------------------
   6. Initialization.
   --------------------------------------------------------------------------- */

function init() {
  injectStyles();

  loadSettings(() => {
    scanFullPage();
    checkAutoClose();
    startObserver();
  });

  chrome.storage.onChanged.addListener(onStorageChanged);
}

if (document.readyState === 'complete') {
  init();
} else {
  window.addEventListener('load', () => init(), { once: true });
}

window.addEventListener('unload', () => {
  stopObserver();
  const el   = document.getElementById(STYLESHEET_ID);
  if (el) el.remove();
});



