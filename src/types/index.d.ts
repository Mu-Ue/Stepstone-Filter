// ===========================================================================
// StepStone Company Filter — Type Definitions (JSDoc)
// ===========================================================================
// These types are documented inline so IDEs can provide rich autocomplete
// even though this is a plain JavaScript project.

/**
 * @typedef {Object} ExtensionSettings
 * Describes the shape of data stored in chrome.storage.sync.
 *
 * @property {string[]} companies            List of company-name filter strings.
 * @property {boolean}  [debugMode]          Whether debug (outline) mode is on.
 * @property {boolean}  [autoCloseApplied]   Whether auto-close lingering tabs is enabled.
 * @property {boolean}  [sortByAlpha]        Whether to sort the options-page list alphabetically.
 */

/**
 * @typedef {Object} MutationPayload
 * @property {'added' | 'removed'} type    - The mutation record type.
 * @property {NodeList}           addedNodes - Newly added child nodes (empty if not 'added').
 * @property {Element}            target     - The node whose subtree was mutated.
 */

/**
 * @typedef {'ready' | 'active' | 'hidden'} VisibilityState
 * Represents the extension content-script lifecycle state on a page.
 */
