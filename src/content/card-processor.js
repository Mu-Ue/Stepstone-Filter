// ===========================================================================
// Stepstone Filter — Card Processor
// ===========================================================================
// Encapsulates the core filtering logic: given a job card, extract the
// company name, check it against the user's filter list, and apply the
// appropriate CSS class (hidden or debug outline).
// ===========================================================================

import { HIDDEN_CLASS, DEBUG_CLASS } from './constants.js';
import { getCompanyText, getTarget, escapeHtml } from './dom-utils.js';

/** @type {string[]} Current company-name filters (all lowercase). */
let companies = [];

/** Whether debug mode is enabled. */
let debugMode = false;

/**
 * Set the current filter list and debug flag. Called whenever storage changes.
 *
 * @param {string[]} newCompanies - Lowercase filter strings.
 * @param {boolean}  newDebugMode - Debug outline toggle.
 */
export function setFilterContext(newCompanies, newDebugMode) {
  companies     = newCompanies;
  debugMode    = newDebugMode;
}

/**
 * Check whether a company name matches any active filter.
 * Uses `some()` with `includes()` for substring matching.
 *
 * @param {string} companyName - Raw company name text (already trimmed).
 * @returns {boolean} True if the company should be filtered.
 */
export function matchesFilter(companyName) {
  const lower = companyName.toLowerCase();
  return companies.some((filter) => lower.includes(filter));
}

/**
 * Process a single job card: check its company name against filters and
 * apply the appropriate CSS class. Does nothing if the card has no company
 * or has already been processed (tracked by *seen*).
 *
 * @param {Element} card - A job-card element from StepStone.de.
 * @param {WeakSet<Element>} seen - WeakSet tracking processed cards.
 */
export function processCard(card, seen) {
  seen.add(card);

  const text = getCompanyText(card);
  if (!text) return; // No company name — skip silently

  const target = getTarget(card);

  if (matchesFilter(text)) {
    if (debugMode) {
      target.classList.add(DEBUG_CLASS);
      target.title = `Would be hidden: ${escapeHtml(text)}`;
    } else {
      target.classList.remove(DEBUG_CLASS);
      target.title   = '';
      target.classList.add(HIDDEN_CLASS);
    }
  } else {
    // Company not in filters — ensure it's visible.
    if (debugMode || target.classList.contains(DEBUG_CLASS)) {
      target.classList.remove(DEBUG_CLASS);
    }
    target.classList.remove(HIDDEN_CLASS);
  }
}
