// ===========================================================================
// Stepstone Filter — DOM Utilities
// ===========================================================================
// Pure helper functions for traversing and interacting with the StepStone.de
// page DOM. No side effects; easy to unit-test in isolation.
// ===========================================================================

import { CARD_SELECTORS, COMPANY_NAME_SELECTORS } from './constants.js';

/**
 * Search a root element (and its descendants) for job card elements,
 * returning only those not yet tracked by *seen* (a WeakSet).
 *
 * @param {Node}   root - The element to search within.
 * @param {WeakSet<Element>} seen - WeakSet of already-processed cards.
 * @returns {Element[]} New card elements found.
 */
export function findCards(root, seen) {
  const found = [];
  for (let s = 0; s < CARD_SELECTORS.length; s++) {
    const els = root.querySelectorAll(CARD_SELECTORS[s]);
    for (let i = 0; i < els.length; i++) {
      if (!seen.has(els[i])) found.push(els[i]);
    }
  }
  return found;
}

/**
 * Extract the company name text from a job card element.
 * Returns an empty string when no company is found (never guesses).
 *
 * @param {Element} card - A job-card element.
 * @returns {string} The trimmed company name, or ''.
 */
export function getCompanyText(card) {
  for (let s = 0; s < COMPANY_NAME_SELECTORS.length; s++) {
    const el = card.querySelector(COMPANY_NAME_SELECTORS[s]);
    if (el?.textContent?.trim()) return el.textContent.trim();
  }
  return '';
}

/**
 * Find the innermost clickable container within a card that the user
 * interacts with (the link or article wrapping the job details).
 *
 * @param {Element} card - A job-card element.
 * @returns {Element} The target element to apply CSS classes to.
 */
export function getTarget(card) {
  // StepStone uses anchor links inside articles for job cards.
  const link = card.querySelector('a[href]');
  return link || card;
}

/**
 * Escape special HTML characters to prevent XSS when using a company name
 * in an HTML context (e.g., as a tooltip title).
 *
 * @param {string} str - Raw string.
 * @returns {string} Escaped string.
 */
export function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
