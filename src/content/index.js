// Stepstone Filter â€” content script
//
// Two independent features:
//   1. Hide job cards in search results whose company matches a filter.
//   2. Auto-close leftover tabs from the application flow.
//
// Optimizations over v1.x:
//   â€¢ MutationObserver scans ONLY newly added nodes (not full DOM every frame)
//   â€¢ CSS class-based hiding via ONE <style> element (fewer style recalcs)
//   â€¢ WeakSet tracking â€” automatic GC when cards leave DOM, zero memory leak
//   â€¢ Visibility API â€” pauses observer when tab is hidden to save resources
//   â€¢ Error boundary in mutation handler so we never break the host page

(() => {
  'use strict';

  // --- Constants ---
  const HIDDEN_CLASS = 'ssf-hidden';
  const DEBUG_CLASS  = 'ssf-debug-outline';

  const CARD_SELECTORS = [
    'article[data-at="job-item"]',
    'article[data-testid="job-item"]',
    '[data-at="job-item"]',
  ];

  const COMPANY_NAME_SELECTORS = [
    '[data-at="job-item-company-name"]',
    '[data-at*="company"]',
  ];

  // --- State (WeakSet = automatic GC, zero memory leak) ---
  let companies = [];
  let debugMode = false;
  let autoCloseApplied = true;
  let appliedCloseTriggered = false;

  const checkedCards = new WeakSet(); // Elements tracked as "already scanned"
                                      // Entries are automatically freed when the
                                      // DOM element is removed from the page.

  let observer = null;
  let mutationPaused = false;

  // --- CSS Stylesheet (single injection â€” one rule per class) ---

  function injectStyles() {
    if (document.getElementById('ssf-styles')) return;
    const el = document.createElement('style');
    el.id = 'ssf-styles';
    el.textContent = [
      '.' + HIDDEN_CLASS + '{display:none !important}',
      '.' + DEBUG_CLASS  + '{outline:3px solid #e53e3e !important}',
    ].join('\n');
    document.head?.prepend(el) || document.documentElement.prepend(el);
  }

  function removeStyles() {
    const el = document.getElementById('ssf-styles');
    if (el) el.remove();
  }

  // --- Core helpers ---

  function findCards(root) {
    const found = [];
    for (let s = 0; s < CARD_SELECTORS.length; s++) {
      const els = root.querySelectorAll(CARD_SELECTORS[s]);
      for (let i = 0; i < els.length; i++) {
        if (!checkedCards.has(els[i])) found.push(els[i]);
      }
    }
    return found;
  }

  function getCompanyText(card) {
    for (let s = 0; s < COMPANY_NAME_SELECTORS.length; s++) {
      const el = card.querySelector(COMPANY_NAME_SELECTORS[s]);
      if (el?.textContent?.trim()) return el.textContent.trim();
    }
    return '';
  }
    function processCard(card) {
    checkedCards.add(card);

    const text = getCompanyText(card);
    if (!text) return; // No company name â€” skip, never guess

    if (matchesFilter(text)) {
      const target = getTarget(card);
      if (debugMode) {
        target.classList.add(DEBUG_CLASS);
        // Sanitize to prevent any possible XSS from company names
        target.title = 'Would be hidden: ' + text.replace(/</g,'&lt;').replace(/>/g,'&gt;');
      } else {
        target.classList.remove(DEBUG_CLASS);
        target.title = '';
        target.classList.add(HIDDEN_CLASS);
      }
    } else if (debugMode) {
      const target = getTarget(card);
      target.classList.remove(DEBUG_CLASS);
      target.title = '';
    }
  }

  /** Return the element to actually hide; prefers parent <li> to avoid orphan spacing. */
  function getTarget(card) {
    const p = card.parentElement;
    if (p?.tagName === 'LI' && !p.classList.contains(HIDDEN_CLASS)) return p;
    return card;
  }

  /** Full-page scan â€” used only on initial load. */
  function scanFullPage() {
    if (companies.length === 0) return;
    const cards = findCards(document.documentElement);
    for (let i = 0; i < cards.length; i++) processCard(cards[i]);
  }

  /** Re-scan only currently visible unprocessed cards. */
  function scanVisiblePage() {
    if (!document.documentElement) return;

    for (const sel of CARD_SELECTORS) {
      const els = document.querySelectorAll(sel);
      for (let i = 0; i < els.length; i++) {
        const card = els[i];
        if (checkedCards.has(card)) continue; // Already processed

        // Skip zero-height/zero-width cards â€” save CPU
        try {
          const rect = card.getBoundingClientRect();
          if (!rect.width && !rect.height) continue;
        } catch { /* Detached element â€” process it anyway */ }

        processCard(card);
      }
    }
  }

  /** Unhide everything visible, then re-scan with current filter set. */
  function resetAndRescan() {
    if (!document.documentElement) return;

    // Phase 1: neutralise â€” un-hide all visible cards first (fast class removal)
    for (const sel of CARD_SELECTORS) {
      const els = document.querySelectorAll(sel);
      for (let i = 0; i < els.length; i++) {
        const card = els[i];
        if (!checkedCards.has(card)) continue;

        try {
          const rect = card.getBoundingClientRect();
          if (!rect.width && !rect.height) continue;
        } catch { /* Detached â€” still unhide */ }

        const target = getTarget(card);
        target.classList.remove(HIDDEN_CLASS, DEBUG_CLASS);
        target.title = '';
      }
    }

    // Phase 2: re-process only visible unprocessed cards (fast)
    scanVisiblePage();
  }

  function matchesFilter(text) {
    if (!text || companies.length === 0) return false;
    const lower = String(text).toLowerCase().trim();
    for (let i = 0; i < companies.length; i++) {
      if (lower.includes(companies[i])) return true;
    }
    return false;
  }

  // --- Feature 2: Auto-close leftover/already-applied tabs ---

  function isDetailPage() {
    return /-inline\.html(?:[/?#]|$)/i.test(location.pathname);
  }

  const TRIGGERS = [
    { text: 'schon beworben',            urlTest: isDetailPage },
    { text: 'hat mit deiner bewerbung alles geklappt?', urlTest: () => true },
  ];

  function checkAutoClose() {
    if (!autoCloseApplied || appliedCloseTriggered) return;

    const els = document.querySelectorAll('[data-genesis-element]');
    for (let i = 0; i < els.length; i++) {
      const el = els[i];

      // Quick rejection of hidden elements â€” faster than reading textContent
      if (el.style.display === 'none' || el.hidden || !el.offsetParent) continue;

      const t = String(el.textContent || '').trim().toLowerCase();
      if (!t) continue;

      for (let j = 0; j < TRIGGERS.length; j++) {
        if (t === TRIGGERS[j].text && TRIGGERS[j].urlTest()) {
          appliedCloseTriggered = true;
          try {
            chrome.runtime.sendMessage({ type: 'ssf-close-applied-tab' });
          } catch (_) { /* Silently ignore messaging errors */ }
          return;
        }
      }
    }
  }

  // --- Smart MutationObserver (scans ONLY added nodes) ---

  let debounceTimer = null;

  function onMutation(mutations) {
    if (mutationPaused || !document.documentElement) return;

    if (debounceTimer !== null) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
      try { // Error boundary: never let us break the host page
        for (let m = 0; m < mutations.length; m++) {
          const mutation = mutations[m];
          if (mutation.type !== 'childList') continue;

          const nodes = mutation.addedNodes;
          for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            if (node.nodeType !== Node.ELEMENT_NODE) continue;

            // Is this node itself a card? Check directly first.
            let isCard = false;
            for (let s = 0; s < CARD_SELECTORS.length; s++) {
              if (node.matches(CARD_SELECTORS[s])) { isCard = true; break; }
            }

            if (isCard && !checkedCards.has(node)) {
              processCard(node);
              continue; // Don't re-scan inside an already-checked card
            }

            // Otherwise search within this node's subtree for cards
            const found = findCards(node);
            for (let c = 0; c < found.length; c++) processCard(found[c]);
          }
        }
        checkAutoClose();
      } catch (err) {
        console.warn('StepStone Filter error:', err);
      }
    }, 100); // Shorter debounce: still safe, catches changes faster
  }

  function startObserver() {
    if (observer || !document.documentElement) return;
    observer = new MutationObserver(onMutation);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: false, // No text-change tracking needed
      attributes: false,    // We manage classes ourselves
    });
  }

  function stopObserver() {
    if (observer) { observer.disconnect(); observer = null; }
  }

  // --- Visibility API: pause when tab hidden to save resources ---

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      mutationPaused = false;
      scanVisiblePage(); // Process cards that appeared while hidden
    } else {
      mutationPaused = true;
    }
  });

  // --- Settings management ---

  function loadSettings(callback) {
    chrome.storage.sync.get(
      { companies: [], debugMode: false, autoCloseApplied: true },
      (items) => {
        companies = [];
        const raw = items.companies || [];
        for (let i = 0; i < raw.length; i++) {
          const v = String(raw[i]).trim();
          if (v) companies.push(v.toLowerCase());
        }
        debugMode = !!items.debugMode;
        autoCloseApplied = items.autoCloseApplied !== false;
        callback?.();
      }
    );
  }

  function onStorageChanged(changes, area) {
    if (area !== 'sync') return;

    loadSettings(() => {
      if ('autoCloseApplied' in changes) {
        appliedCloseTriggered = false;
        checkAutoClose();
      }
      if ('companies' in changes || 'debugMode' in changes) {
        resetAndRescan();
      }
    });
  }

  // --- Initialization (waits for DOM to be ready) ---

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

  // Cleanup on page navigation/refresh (pagehide is the CSP-safe replacement for unload)
  try { window.addEventListener("pagehide", function() { stopObserver(); removeStyles(); }); } catch (_) {}
})();
