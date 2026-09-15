// StepStone Filter — Options page (enhanced v2)
// Features: search/filter, selected items + Delete key, comma-separated input,
//           alphabetical sort toggle, export/import JSON backup
(() => {
  'use strict';

  // --- DOM refs ---
  const companyInput   = document.getElementById('companyInput');
  const addBtn         = document.getElementById('addBtn');
  const companyList    = document.getElementById('companyList');
  const emptyMsg       = document.getElementById('emptyMsg');
  const debugModeInput = document.getElementById('debugMode');
  const autoCloseInput = document.getElementById('autoCloseApplied');
  const savedMsg       = document.getElementById('savedMsg');
  const searchInput    = document.getElementById('searchInput');
  const sortByAlphaChk = document.getElementById('sortByAlpha');
  const exportBtn      = document.getElementById('exportBtn');
  const importFile     = document.getElementById('importFile');

  // --- State ---
  let companies = [];
  let selectedIndex = -1;
  let filteredIndices = [];
  let saveDebounceId = null;

  // ---------- Saving ----------
  function scheduleSave() {
    if (saveDebounceId) clearTimeout(saveDebounceId);
    saveDebounceId = setTimeout(() => {
      chrome.storage.sync.set({
        companies,
        debugMode: debugModeInput.checked,
        autoCloseApplied: autoCloseInput.checked,
        sortByAlpha: sortByAlphaChk.checked,
      }, () => showSaved());
    }, 150);
  }

  function showSaved() {
    savedMsg.style.opacity = '1';
    setTimeout(() => { savedMsg.style.opacity = '0'; }, 1200);
  }

  // ---------- Rendering ----------
  function getFilteredIndices() {
    const q = (searchInput.value || '').trim().toLowerCase();
    if (!q) return companies.map((_, i) => i);
    const result = [];
    for (let i = 0; i < companies.length; i++) {
      if (companies[i].toLowerCase().includes(q)) result.push(i);
    }
    return result;
  }

  function render() {
    filteredIndices = getFilteredIndices();
    const q = (searchInput.value || '').trim().toLowerCase();

    let displayOrder;
    if (sortByAlphaChk.checked) {
      const paired = filteredIndices.map(i => ({ i, name: companies[i].toLowerCase() }));
      paired.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
      displayOrder = paired.map(p => p.i);
    } else {
      displayOrder = [...filteredIndices];
    }

    companyList.innerHTML = '';
    emptyMsg.style.display = (companies.length === 0) ? 'block' : 'none';

    for (let d = 0; d < displayOrder.length; d++) {
      const idx = displayOrder[d];
      const name = companies[idx];

      const li = document.createElement('li');
      li.dataset.index = idx;
      if (idx === selectedIndex) li.classList.add('selected');

      const count = companies.filter(c => c.toLowerCase() === name.toLowerCase()).length;
      const numSpan = document.createElement('span');
      numSpan.textContent = count > 1 ? `#${count} · ` : '';

      const textSpan = document.createElement('span');
      textSpan.className = 'company-name';
      textSpan.title = name;

      if (q) {
        const lowerName = name.toLowerCase();
        const qLower = q;
        const pos = lowerName.indexOf(qLower);
        if (pos !== -1) {
          const before = name.slice(0, pos);
          const match = name.slice(pos, pos + q.length);
          const after = name.slice(pos + q.length);
          textSpan.innerHTML = esc(before) + '<mark>' + esc(match) + '</mark>' + esc(after);
        } else {
          textSpan.textContent = name;
        }
      } else {
        textSpan.textContent = name;
      }

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-danger btn-sm';
      delBtn.textContent = 'Remove';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        companies.splice(parseInt(li.dataset.index, 10), 1);
        selectedIndex = -1;
        scheduleSave();
        render();
      });

      li.appendChild(numSpan);
      li.appendChild(textSpan);
      li.appendChild(delBtn);
      companyList.appendChild(li);
    }
  }

  function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ---------- Add companies ----------
  function addCompany() {
    const val = companyInput.value.trim();
    if (!val) return;
    const parts = val.split(',').map(s => s.trim()).filter(Boolean);
    for (let p = 0; p < parts.length; p++) {
      const name = parts[p];
      const exists = companies.some(c => c.toLowerCase() === name.toLowerCase());
      if (!exists) companies.push(name);
    }
    companyInput.value = '';
    scheduleSave();
    render();
    companyInput.focus();
  }

  // ---------- Selection for Delete key ----------
  function selectNextItem(delta) {
    if (filteredIndices.length === 0) return;
    selectedIndex += delta;
    if (selectedIndex >= filteredIndices.length) selectedIndex = filteredIndices.length - 1;
    if (selectedIndex < 0) selectedIndex = 0;
    render();
    const li = companyList.querySelector('li[data-index="' + selectedIndex + '"]');
    if (li) li.scrollIntoView({ block: 'nearest' });
  }

  // ---------- Import / Export ----------
  function exportSettings() {
    const data = JSON.stringify({
      companies,
      debugMode: debugModeInput.checked,
      autoCloseApplied: autoCloseInput.checked,
      sortByAlpha: sortByAlphaChk.checked,
      exportedAt: new Date().toISOString(),
    }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stepstone-filter-settings.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importSettings(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data.companies)) throw new Error('Missing companies array');
        let added = 0;
        for (let i = 0; i < data.companies.length; i++) {
          const name = String(data.companies[i]).trim();
          if (!name) continue;
          if (!companies.some(c => c.toLowerCase() === name.toLowerCase())) {
            companies.push(name); added++;
          }
        }
        debugModeInput.checked = !!data.debugMode;
        autoCloseInput.checked = data.autoCloseApplied !== false;
        sortByAlphaChk.checked = !!data.sortByAlpha;
        scheduleSave();
        render();
        savedMsg.textContent = 'Imported ' + added + ' new (total: ' + companies.length + ')';
        savedMsg.style.opacity = '1';
        setTimeout(() => { savedMsg.style.opacity = '0'; savedMsg.textContent = 'Saved'; }, 2500);
      } catch (err) {
        alert('Failed to import settings: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  // ---------- Event listeners ----------
  addBtn.addEventListener('click', addCompany);
  companyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addCompany(); }
  });

  searchInput.addEventListener('input', () => { render(); });

  autoCloseInput.addEventListener('change', scheduleSave);
  debugModeInput.addEventListener('change', scheduleSave);
  sortByAlphaChk.addEventListener('change', () => { scheduleSave(); render(); });

  exportBtn.addEventListener('click', exportSettings);
  importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) { importSettings(file); e.target.value = ''; }
  });

  companyList.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    selectedIndex = parseInt(li.dataset.index, 10);
    render();
    const sel = companyList.querySelector('li[data-index="' + selectedIndex + '"]');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  });

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' && e.key !== 'Escape') return;

    if (e.key === 'Delete' && selectedIndex >= 0) {
      e.preventDefault();
      companies.splice(selectedIndex, 1);
      selectedIndex = -1;
      scheduleSave();
      render();
      return;
    }

    if (e.key === 'Escape') {
      if (searchInput.value) { searchInput.value = ''; render(); e.preventDefault(); return; }
      if (document.activeElement === companyInput) {
        companyInput.blur(); e.preventDefault(); return;
      }
    }

    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && document.activeElement !== companyInput) {
      const delta = e.key === 'ArrowUp' ? -1 : 1;
      selectNextItem(delta);
      e.preventDefault();
    }
  });

  // ---------- Load settings on init ----------
  chrome.storage.sync.get(
    { companies: [], debugMode: false, autoCloseApplied: true, sortByAlpha: false },
    (items) => {
      companies = items.companies || [];
      debugModeInput.checked = !!items.debugMode;
      autoCloseInput.checked = items.autoCloseApplied !== false;
      sortByAlphaChk.checked = !!items.sortByAlpha;
      render();
    }
  );

})();

