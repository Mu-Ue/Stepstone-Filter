// ===========================================================================
// Stepstone Filter — Options Page Application Logic (app.js)
// ===========================================================================
// Handles:
//   • Rendering the company filter list with search, selection, and sorting
//   • Adding / removing filters from chrome.storage.sync
//   • Export / import of settings as JSON backups
//   • Keyboard shortcuts for accessibility
// ===========================================================================

(() => {
  'use strict';

  // ---- DOM references -------------------------------------------------------

  const companyInput     = document.getElementById('companyInput');
  const addBtn           = document.getElementById('addBtn');
  const companyList      = document.getElementById('companyList');
  const emptyMsg         = document.getElementById('emptyMsg');
  const debugModeInp     = document.getElementById('debugMode');
  const autoCloseInp     = document.getElementById('autoCloseApplied');
  const savedMsg         = document.getElementById('savedMsg');
  const searchInput      = document.getElementById('searchInput');
  const sortByAlphaChk   = document.getElementById('sortByAlpha');
  const exportBtn        = document.getElementById('exportBtn');
  const importFile       = document.getElementById('importFile');

  // ---- Application state ----------------------------------------------------

  /** @type {string[]} */
  let companies = [];

  /** @type {number} Index of the currently selected item (or -1) */
  let selectedIndex = -1;

  /** @type {number[]} Filtered indices for the current render pass */
  let filteredIndices = [];

  /** @type {ReturnType<typeof setTimeout> | null} Debounce handle */
  let saveDebounceId = null;

  // ---- Saving ---------------------------------------------------------------

  /** Queue a debounced save to chrome.storage.sync. */
  function scheduleSave() {
    if (saveDebounceId) clearTimeout(saveDebounceId);
    saveDebounceId = setTimeout(() => {
      chrome.storage.sync.set(
        {
          companies,
          debugMode: debugModeInp.checked,
          autoCloseApplied: autoCloseInp.checked,
          sortByAlpha: sortByAlphaChk.checked,
        },
        () => showSaved()
      );
    }, 150);
  }

  /** Briefly flash the "Saved" indicator. */
  function showSaved() {
    savedMsg.style.opacity = '1';
    setTimeout(() => {
      savedMsg.style.opacity = '0';
      savedMsg.textContent = 'Saved';
    }, 1200);
  }

  // ---- Rendering -----------------------------------------------------------

  /** Get indices matching the current search text. */
  function getFilteredIndices() {
    const q = (searchInput.value || '').trim().toLowerCase();
    if (!q) return companies.map((_, i) => i);
    const result = [];
    for (let i = 0; i < companies.length; i++) {
      if (companies[i].toLowerCase().includes(q)) result.push(i);
    }
    return result;
  }

  /** Render the company list to the DOM. */
  function render() {
    filteredIndices = getFilteredIndices();
    const q = (searchInput.value || '').trim().toLowerCase();

    let displayOrder;
    if (sortByAlphaChk.checked) {
      const paired = filteredIndices.map((i) => ({ i, name: companies[i].toLowerCase() }));
      paired.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      displayOrder = paired.map((p) => p.i);
    } else {
      displayOrder = [...filteredIndices];
    }

    companyList.innerHTML = '';
    emptyMsg.style.display = companies.length === 0 ? 'block' : 'none';

    for (let d = 0; d < displayOrder.length; d++) {
      const idx   = displayOrder[d];
      const name  = companies[idx];
      const li    = document.createElement('li');
      li.dataset.index = idx;
      if (idx === selectedIndex) li.classList.add('selected');

      // Count duplicates (case-insensitive).
      const count = companies.filter((c) => c.toLowerCase() === name.toLowerCase()).length;
      const numSpan     = document.createElement('span');
      numSpan.textContent = count > 1 ? `#${count} · ` : '';

      const textSpan   = document.createElement('span');
      textSpan.className = 'company-name';
      textSpan.title    = name;

      // Highlight the search query within the name.
      if (q) {
        const lowerName = name.toLowerCase();
        const pos = lowerName.indexOf(q);
        if (pos !== -1) {
          const before  = name.slice(0, pos);
          const match   = name.slice(pos, pos + q.length);
          const after   = name.slice(pos + q.length);
          textSpan.innerHTML = `${escapeHtml(before)}<mark>${escapeHtml(match)}</mark>${escapeHtml(after)}`;
        } else {
          textSpan.textContent = escapeHtml(name);
        }
      } else {
        textSpan.textContent = name;
      }

      const removeBtn  = document.createElement('button');
      removeBtn.className = 'btn-danger btn-sm';
      removeBtn.type    = 'button';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        companies.splice(idx, 1);
        selectedIndex = -1;
        scheduleSave();
        render();
      });

      li.append(numSpan, textSpan, removeBtn);
      companyList.appendChild(li);
    }
  }

  // ---- Helpers -------------------------------------------------------------

  /** Escape HTML to prevent XSS from untrusted company names. */
  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---- Company management --------------------------------------------------

  /** Parse comma-separated input and add each non-empty entry. */
  function addCompany() {
    const raw   = companyInput.value || '';
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return;

    let added = 0;
    for (const name of parts) {
      const lower = name.toLowerCase();
      if (!companies.some((c) => c.toLowerCase() === lower)) {
        companies.push(name);
        added++;
      }
    }
    scheduleSave();
    render();

    companyInput.value   = '';
    selectedIndex         = companies.length > 0 ? companies.length - 1 : -1;
    if (added > 0) {
      savedMsg.textContent = `Added ${added} new filter${added > 1 ? 's' : ''}`;
      showSaved();
    }
  }

  // ---- Selection helpers ---------------------------------------------------

  /** Move the visual selection up or down by *delta* (typically ±1). */
  function selectNextItem(delta) {
    if (filteredIndices.length === 0) return;
    const currentPos = filteredIndices.indexOf(selectedIndex);
    let nextPos      = currentPos + delta;
    if (nextPos < 0)       nextPos = filteredIndices.length - 1;
    if (nextPos >= filteredIndices.length) nextPos = 0;
    selectedIndex   = filteredIndices[nextPos];
    render();

    const el = companyList.querySelector(`li[data-index="${selectedIndex}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  // ---- Export / Import -----------------------------------------------------

  /** Download current settings as a JSON file. */
  function exportSettings() {
    const data = {
      companies,
      debugMode: debugModeInp.checked,
      autoCloseApplied: autoCloseInp.checked,
      sortByAlpha: sortByAlphaChk.checked,
    };
    const blob   = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href       = url;
    a.download   = 'stepstone-filter-settings.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);

    savedMsg.textContent = `Exported ${companies.length} filter${companies.length !== 1 ? 's' : ''}`;
    showSaved();
  }

  /** Load settings from an uploaded JSON file, merging companies. */
  function importSettings(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data       = JSON.parse(e.target.result);
        if (!Array.isArray(data.companies))
          throw new Error('Missing "companies" array');

        let added = 0;
        for (let i = 0; i < data.companies.length; i++) {
          const name   = String(data.companies[i]).trim();
          if (!name) continue;
          if (!companies.some((c) => c.toLowerCase() === name.toLowerCase())) {
            companies.push(name);
            added++;
          }
        }

        debugModeInp.checked       = !!data.debugMode;
        autoCloseInp.checked       = data.autoCloseApplied !== false;
        sortByAlphaChk.checked     = !!data.sortByAlpha;
        scheduleSave();
        render();

        savedMsg.textContent = `Imported ${added} new (total: ${companies.length})`;
        showSaved();
      } catch (err) {
        alert('Failed to import settings: ' + err.message);
      }
    };
    reader.readAsText(file);
  }


  // ---- Event listeners -----------------------------------------------------

  addBtn.addEventListener('click', addCompany);
  companyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addCompany(); }
  });

  searchInput.addEventListener('input', () => render());

  autoCloseInp.addEventListener('change', scheduleSave);
  debugModeInp.addEventListener('change', scheduleSave);
  sortByAlphaChk.addEventListener(
    'change',
    () => { scheduleSave(); render(); }
  );

  exportBtn.addEventListener('click', exportSettings);
  importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) { importSettings(file); e.target.value = ''; }
  });

  companyList.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    selectedIndex   = parseInt(li.dataset.index, 10);
    render();
    const el = companyList.querySelector(`li[data-index="${selectedIndex}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  });

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' && e.key !== 'Escape') return;

    if (e.key === 'Delete' && selectedIndex >= 0) {
      e.preventDefault();
      companies.splice(selectedIndex, 1);
      selectedIndex   = -1;
      scheduleSave();
      render();
      return;
    }

    if (e.key === 'Escape') {
      if (searchInput.value) { searchInput.value = ''; render(); e.preventDefault(); return; }
      if (document.activeElement === companyInput) {
        companyInput.blur();
        e.preventDefault();
        return;
      }
    }

    if (
      (e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
      document.activeElement !== companyInput
    ) {
      const delta   = e.key === 'ArrowUp' ? -1 : 1;
      selectNextItem(delta);
      e.preventDefault();
    }
  });

  // ---- Load settings on init -----------------------------------------------

  chrome.storage.sync.get(
    {
      companies: [],
      debugMode: false,
      autoCloseApplied: true,
      sortByAlpha: false,
    },
    (items) => {
      companies         = items.companies || [];
      debugModeInp.checked     = !!items.debugMode;
      autoCloseInp.checked     = items.autoCloseApplied !== false;
      sortByAlphaChk.checked   = !!items.sortByAlpha;
      render();
    }
  );
})();

