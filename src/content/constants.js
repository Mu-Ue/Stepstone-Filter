// ============================================================================
// stepstone-filter — Shared Constants
// ============================================================================
// All magic strings, CSS class names, and selector arrays are centralized
// here to avoid duplication and make them easy to audit / update.
// ===========================================================================

/** @type {string} CSS class applied to cards that match the filter (hidden) */
export const HIDDEN_CLASS = 'ssf-hidden';

/** @type {string} CSS class for debug-mode red outline (not hidden) */
export const DEBUG_CLASS = 'ssf-debug-outline';

/** @type {string} ID of the injected <style> element */
export const STYLESHEET_ID = 'ssf-styles';

/**
 * Query selectors used to find job card containers on StepStone.
 * Checked in order; first match wins.
 */
export const CARD_SELECTORS = [
  'article[data-at="job-item"]',
  'article[data-testid="job-item"]',
  '[data-at="job-item"]',
];

/**
 * Query selectors used to find the company-name element inside a job card.
 * Checked in order; first non-empty text wins.
 */
export const COMPANY_NAME_SELECTORS = [
  '[data-at="job-item-company-name"]',
  '[data-at*="company"]',
];

/**
 * MutationObserver options — we only care about new elements,
 * not text changes or attribute mutations (we manage classes ourselves).
 */
export const OBSERVER_OPTIONS = {
  childList: true,
  subtree: true,
  characterData: false,
  attributes: false,
};

/** How long to wait (ms) after the last DOM change before processing. */
export const MUTATION_DEBOUNCE_MS = 100;
