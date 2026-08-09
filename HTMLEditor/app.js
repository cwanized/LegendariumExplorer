// LegendariumExplorer Data Editor - Application Logic
// Client-side only - data is embedded in data.js

let allPersons = PERSONS_DATA || [];
let allRelations = RELATIONS_DATA || [];
let selectedPerson = null;
let currentDataset = CURRENT_DATASET || 'demo';

// Theme Toggle
const themeToggle = document.getElementById('themeToggle');
const html = document.documentElement;

// Load saved theme
const savedTheme = localStorage.getItem('theme') || 'dark';
html.setAttribute('data-theme', savedTheme);

themeToggle.addEventListener('click', () => {
  const current = html.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  console.log('Theme changed to:', next);
});

// Dataset Selector
const datasetSelect = document.getElementById('datasetSelect');

// Populate dataset dropdown
function initDatasetSelector() {
  if (typeof AVAILABLE_DATASETS === 'undefined') {
    console.warn('AVAILABLE_DATASETS not defined');
    return;
  }
  
  datasetSelect.innerHTML = '';
  AVAILABLE_DATASETS.forEach(dataset => {
    const option = document.createElement('option');
    option.value = dataset;
    option.textContent = dataset;
    if (dataset === currentDataset) {
      option.selected = true;
    }
    datasetSelect.appendChild(option);
  });
  
  datasetSelect.addEventListener('change', (e) => {
    const newDataset = e.target.value;
    switchDataset(newDataset);
  });
  
  console.log('Dataset selector initialized with:', AVAILABLE_DATASETS);
}

// Switch dataset
function switchDataset(datasetName) {
  if (typeof ALL_DATASETS_DATA === 'undefined') {
    console.error('ALL_DATASETS_DATA not defined');
    return;
  }
  
  const data = ALL_DATASETS_DATA[datasetName];
  if (!data) {
    console.error(`Dataset '${datasetName}' not found`);
    showToast(`Datensatz '${datasetName}' nicht gefunden`, 'error');
    return;
  }
  
  currentDataset = datasetName;
  CURRENT_DATASET = datasetName;
  allPersons = data.persons || [];
  allRelations = data.relations || [];
  selectedPerson = null;
  
  console.log(`Switched to dataset: ${datasetName} (${allPersons.length} persons, ${allRelations.length} relations)`);
  
  // Re-render everything
  renderPersonList(allPersons);
  document.getElementById('personSearch').value = '';
  
  document.getElementById('detailView').innerHTML = '<p style="color: var(--text-secondary);">Wähle eine Person aus der Liste...</p>';
  document.getElementById('relationsView').innerHTML = '<p style="color: var(--text-secondary);">Wähle eine Person um Beziehungen zu sehen...</p>';
  
  showToast(`Wechsle zu Datensatz: ${datasetName}`, 'success');
}

console.log('App loaded, theme:', savedTheme);

// Backend status removed - client-only now
const backendStatus = document.getElementById('backendStatus');
if (backendStatus) {
  backendStatus.innerHTML = '<span style="color: var(--text-secondary); font-size: 0.8rem;">📁 Client-Only — Export/Import</span>';
  backendStatus.style.background = 'transparent';
}

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Load persons - client-side, data already loaded
function loadPersons() {
  console.log(`Loaded ${allPersons.length} persons`);
  renderPersonList(allPersons);
}

// Load relations for person - client-side, data already loaded
function loadRelationsForPerson(personId) {
  renderRelations(personId);
}

// Render person list
function renderPersonList(persons) {
  const list = document.getElementById('personList');
  list.innerHTML = '';
  
  persons.forEach(person => {
    const li = document.createElement('li');
    li.className = `person-list ${person.gender === 'female' ? 'female' : person.species === 'Elf' ? 'elf' : person.species === 'Dwarf' ? 'dwarf' : 'male'}`;
    li.innerHTML = `
      <div class="name">${person.name}</div>
      <div class="meta">${person.species || 'Unknown'} • ${person.gender || 'unknown'}</div>
    `;
    li.addEventListener('click', () => selectPerson(person));
    list.appendChild(li);
  });
}

// Navigation history for back/forward
let navHistory = [];
let navHistoryIndex = -1;

// Normalize string for search (remove umlauts/special chars)
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[äöüß]/g, c => ({'ä': 'a', 'ö': 'o', 'ü': 'u', 'ß': 'ss'}[c] || c));
}

// Load house definitions from current dataset
let houseDefinitions = [];

function loadHouseDefinitions() {
  const housesSet = new Set();
  allPersons.forEach(p => {
    if (p.houses && Array.isArray(p.houses)) {
      p.houses.forEach(h => housesSet.add(h));
    }
  });
  houseDefinitions = Array.from(housesSet).sort();
  
  console.log(`Loaded ${houseDefinitions.length} houses: ${houseDefinitions.join(', ')}`);
  
  const houseSelect = document.getElementById('houseSelect');
  if (houseSelect) {
    houseSelect.innerHTML = '<option value="">-- House wählen --</option>';
    houseDefinitions.forEach(house => {
      const option = document.createElement('option');
      option.value = house;
      option.textContent = house;
      houseSelect.appendChild(option);
    });
    console.log(`Populated house dropdown with ${houseDefinitions.length} options`);
  } else {
    console.warn('houseSelect element not found');
  }
}

// Navigate to person and add to history
function navigateToPerson(person) {
  // Add to history if different from current
  if (!selectedPerson || selectedPerson.id !== person.id) {
    // Remove any forward history
    navHistory = navHistory.slice(0, navHistoryIndex + 1);
    navHistory.push(person.id);
    navHistoryIndex = navHistory.length - 1;
  }
  
  selectPerson(person);
  updateNavButtons();
}

// Go back in history
function navBack() {
  if (navHistoryIndex > 0) {
    navHistoryIndex--;
    const personId = navHistory[navHistoryIndex];
    const person = allPersons.find(p => p.id === personId);
    if (person) {
      selectPerson(person);
      updateNavButtons();
    }
  }
}

// Go forward in history
function navForward() {
  if (navHistoryIndex < navHistory.length - 1) {
    navHistoryIndex++;
    const personId = navHistory[navHistoryIndex];
    const person = allPersons.find(p => p.id === personId);
    if (person) {
      selectPerson(person);
      updateNavButtons();
    }
  }
}

// Update navigation button states
function updateNavButtons() {
  const backBtn = document.getElementById('navBack');
  const forwardBtn = document.getElementById('navForward');
  
  if (backBtn) {
    backBtn.disabled = navHistoryIndex <= 0;
    backBtn.style.opacity = navHistoryIndex <= 0 ? '0.5' : '1';
    backBtn.style.cursor = navHistoryIndex <= 0 ? 'not-allowed' : 'pointer';
  }
  
  if (forwardBtn) {
    forwardBtn.disabled = navHistoryIndex >= navHistory.length - 1;
    forwardBtn.style.opacity = navHistoryIndex >= navHistory.length - 1 ? '0.5' : '1';
    forwardBtn.style.cursor = navHistoryIndex >= navHistory.length - 1 ? 'not-allowed' : 'pointer';
  }
}

// Select person
function selectPerson(person) {
  selectedPerson = person;
  
  // Update active state
  document.querySelectorAll('.person-list li').forEach(li => {
    li.classList.remove('active');
    if (li.querySelector('.name').textContent === person.name) {
      li.classList.add('active');
    }
  });
  
  renderDetailView(person);
  loadRelationsForPerson(person.id);
  renderValidationResults(person);
  updateNavButtons();
}

// Render detail view
function renderDetailView(person) {
  const view = document.getElementById('detailView');
  
  const portraitHtml = person.portraitUrl 
    ? `<img src="${person.portraitUrl}" alt="${person.name}" class="portrait">`
    : `<div class="portrait-placeholder">👤</div>`;
  
  view.innerHTML = `
    <div class="detail-header">
      ${portraitHtml}
      <div class="detail-info">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
          <button class="btn btn-small" id="navBack" onclick="navBack()" title="Zurück" style="padding: 0.4rem 0.6rem;">←</button>
          <button class="btn btn-small" id="navForward" onclick="navForward()" title="Vor" style="padding: 0.4rem 0.6rem;">→</button>
        </div>
        <h2>${person.name}</h2>
        <span class="species-badge ${person.species || ''}">${person.species || 'Unknown'}</span>
      </div>
    </div>
    
    <form id="personForm" class="form-grid">
      <div class="form-group">
        <label>Name</label>
        <input type="text" id="editName" value="${person.name}" required>
      </div>
      <div class="form-group">
        <label>Gender</label>
        <select id="editGender">
          <option value="male" ${person.gender === 'male' ? 'selected' : ''}>Male</option>
          <option value="female" ${person.gender === 'female' ? 'selected' : ''}>Female</option>
          <option value="other" ${person.gender === 'other' ? 'selected' : ''}>Other</option>
        </select>
      </div>
      <div class="form-group">
        <label>Species</label>
        <select id="editSpecies">
          <option value="Man" ${person.species === 'Man' ? 'selected' : ''}>Man</option>
          <option value="Woman" ${person.species === 'Woman' ? 'selected' : ''}>Woman</option>
          <option value="Elf" ${person.species === 'Elf' ? 'selected' : ''}>Elf</option>
          <option value="Dwarf" ${person.species === 'Dwarf' ? 'selected' : ''}>Dwarf</option>
          <option value="Hobbit" ${person.species === 'Hobbit' ? 'selected' : ''}>Hobbit</option>
          <option value="Maiar" ${person.species === 'Maiar' ? 'selected' : ''}>Maiar</option>
          <option value="Valar" ${person.species === 'Valar' ? 'selected' : ''}>Valar</option>
        </select>
      </div>
      <div class="form-group">
        <label>Birth Era</label>
        <input type="text" id="editBirthEra" value="${person.birth?.era || ''}">
      </div>
      <div class="form-group">
        <label>Birth Year</label>
        <input type="number" id="editBirthYear" value="${person.birth?.year || ''}">
      </div>
      <div class="form-group">
        <label>Death Era</label>
        <input type="text" id="editDeathEra" value="${person.death?.era || ''}">
      </div>
      <div class="form-group">
        <label>Death Year</label>
        <input type="number" id="editDeathYear" value="${person.death?.year || ''}">
      </div>
      <div class="form-group full-width">
        <label>Houses (comma-separated)</label>
        <input type="text" id="editHouses" value="${(person.houses || []).join(', ')}" placeholder="z.B. House of Bëor, Dunedain" onblur="trimHousesOnBlur()">
        <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem; align-items: center;">
          <select id="houseSelect" style="flex: 1; padding: 0.4rem; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 4px; color: var(--text-primary); font-size: 0.85rem;">
            <option value="">-- House wählen --</option>
          </select>
          <button type="button" class="btn btn-small" onclick="addSelectedHouse()" style="padding: 0.4rem 0.6rem;">➕ Add</button>
        </div>
      </div>
      <div class="form-group full-width">
        <label>Description</label>
        <textarea id="editDescription" rows="3">${person.metadata?.description || ''}</textarea>
      </div>
      <div class="form-group full-width">
        <label>Source Links</label>
        <div id="sourceLinksEditor">
          ${(person.sourceLinks || []).map((sl, idx) => `
            <div class="source-link-row" style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
              <input type="text" placeholder="Label" value="${sl.label || ''}" class="source-label" style="flex: 1; padding: 0.4rem;">
              <input type="text" placeholder="URL" value="${sl.url || ''}" class="source-url" style="flex: 2; padding: 0.4rem;">
              <button type="button" class="btn btn-small btn-danger" onclick="removeSourceLink(this)" style="padding: 0.4rem;">🗑️</button>
            </div>
          `).join('')}
          <button type="button" class="btn btn-small" onclick="addSourceLink()" style="margin-top: 0.5rem;">➕ Source hinzufügen</button>
        </div>
      </div>
      <div class="form-group full-width">
        <label>Portrait URL</label>
        <input type="text" id="editPortraitUrl" value="${person.portraitUrl || ''}">
      </div>
      <div class="btn-group">
        <button type="submit" class="btn btn-success">💾 Speichern</button>
        <button type="button" class="btn btn-danger" onclick="deletePerson()">🗑️ Löschen</button>
      </div>
    </form>
  `;
  
  document.getElementById('personForm').addEventListener('submit', savePerson);
  
  // Load house definitions after form is rendered
  loadHouseDefinitions();
}

// Save person - Export to file (client-only, no backend)
async function savePerson(e) {
  e.preventDefault();
  
  const updated = {
    ...selectedPerson,
    name: document.getElementById('editName').value,
    gender: document.getElementById('editGender').value,
    species: document.getElementById('editSpecies').value,
    birth: {
      era: document.getElementById('editBirthEra').value || null,
      year: document.getElementById('editBirthYear').value ? parseInt(document.getElementById('editBirthYear').value) : null
    },
    death: {
      era: document.getElementById('editDeathEra').value || null,
      year: document.getElementById('editDeathYear').value ? parseInt(document.getElementById('editDeathYear').value) : null
    },
    houses: document.getElementById('editHouses').value.split(',').map(s => s.trim()).filter(s => s),
    metadata: {
      description: document.getElementById('editDescription').value
    },
    sourceLinks: getSourceLinks(),
    portraitUrl: document.getElementById('editPortraitUrl').value
  };
  
  // Export as JSON file - user chooses save location
  const filename = `${updated.id}_${updated.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.json`;
  const blob = new Blob([JSON.stringify(updated, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  
  // Update local data
  const idx = allPersons.findIndex(p => p.id === updated.id);
  if (idx >= 0) {
    allPersons[idx] = updated;
  } else {
    allPersons.push(updated);
  }
  selectedPerson = updated;
  
  showToast(`✓ Export: ${filename} — Speichere im Dataset-Ordner!`, 'success');
}

// Delete person - client-only
async function deletePerson() {
  if (!confirm(`Person "${selectedPerson.name}" wirklich löschen?\n\n⚠️ Datei muss manuell im Dataset-Ordner gelöscht werden!`)) return;
  
  // Remove from local data only
  allPersons = allPersons.filter(p => p.id !== selectedPerson.id);
  selectedPerson = null;
  document.getElementById('detailView').innerHTML = '<p style="color: var(--text-secondary);">Person entfernt. Wähle eine andere Person...</p>';
  document.getElementById('relationsView').innerHTML = '<p style="color: var(--text-secondary);">Wähle eine Person um Beziehungen zu sehen...</p>';
  renderPersonList(allPersons);
  
  showToast('⚠️ Person lokal entfernt — Datei manuell löschen!', 'warning');
}

// Load relations for person - client-side, data already loaded
function loadRelationsForPerson(personId) {
  renderRelations(personId);
  renderFamilyTreePreview(personId);
}

// Remove old fetch-based function

// Render family tree preview
function renderFamilyTreePreview(personId) {
  const container = document.getElementById('familyTreePreview');
  const person = allPersons.find(p => p.id === personId);
  
  if (!person) {
    container.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem;">Person nicht gefunden</p>';
    return;
  }
  
  // Find all relations (support both "parent" and "biological_parent" types)
  const isParentRelation = (r) => r.type === 'parent' || r.type === 'biological_parent';
  
  const parents = allRelations.filter(r => r.to === personId && isParentRelation(r));
  const children = allRelations.filter(r => r.from === personId && isParentRelation(r));
  const siblings = [];
  const grandparents = [];
  
  // Find siblings (children of parents) - show side by side
  parents.forEach(parentRel => {
    const parentId = parentRel.from;
    const siblingsFromParent = allRelations.filter(r => 
      r.from === parentId && isParentRelation(r) && r.to !== personId
    );
    siblingsFromParent.forEach(sibRel => {
      if (!siblings.find(s => s.id === sibRel.to)) {
        siblings.push(sibRel);
      }
    });
  });
  
  // Find grandparents (parents of parents)
  parents.forEach(parentRel => {
    const parentId = parentRel.from;
    const grandparentRels = allRelations.filter(r => 
      r.to === parentId && isParentRelation(r)
    );
    grandparentRels.forEach(gpRel => {
      if (!grandparents.find(gp => gp.id === gpRel.id)) {
        grandparents.push(gpRel);
      }
    });
  });
  
  // Build tree HTML - compact layout
  let html = '<h3>🌳 Stammbaum</h3><div class="family-tree">';
  
  // Helper to create tree node
  const createTreeNode = (p, label = '') => {
    const icon = getPersonIcon(p);
    const genderText = p.gender === 'male' ? '♂' : p.gender === 'female' ? '♀' : '';
    return `
      <div class="tree-node" onclick="navigateToPersonById('${p.id}')">
        <div class="tree-node-content">
          <div class="tree-node-icon">${icon}</div>
          <div class="tree-node-name">${p.name} ${genderText}</div>
          ${label ? `<div class="tree-node-meta">${label}</div>` : ''}
        </div>
      </div>
    `;
  };
  
  // Helper to create a level (siblings side by side)
  const createLevel = (nodes, sectionClass, label) => {
    if (nodes.length === 0) return '';
    
    let levelHtml = `<div class="tree-level tree-section-${sectionClass}">`;
    levelHtml += `<div class="tree-section-label">${label} (${nodes.length})</div>`;
    levelHtml += '</div><div class="tree-level">';
    
    // Siblings side by side with minimal connectors
    nodes.forEach((node, idx) => {
      levelHtml += node;
    });
    
    levelHtml += '</div>';
    return levelHtml;
  };
  
  // Grandparents
  if (grandparents.length > 0) {
    const gpIds = [...new Set(grandparents.map(r => r.from))];
    const gpNodes = gpIds.map(gpId => {
      const gp = allPersons.find(p => p.id === gpId);
      return gp ? createTreeNode(gp) : '';
    }).filter(Boolean);
    html += createLevel(gpNodes, 'grandparents', 'Großeltern');
    if (parents.length > 0) html += '<div class="tree-connector"></div>';
  }
  
  // Parents
  if (parents.length > 0) {
    const parentNodes = parents.map(rel => {
      const parent = allPersons.find(p => p.id === rel.from);
      return parent ? createTreeNode(parent, rel.type) : '';
    }).filter(Boolean);
    html += createLevel(parentNodes, 'parents', 'Eltern');
    html += '<div class="tree-connector"></div>';
  }
  
  // Current person (center)
  html += '<div class="tree-level">';
  html += createTreeNode(person, '★');
  html += '</div>';
  
  // Children/Siblings connector
  if (children.length > 0 || siblings.length > 0) {
    html += '<div class="tree-connector"></div>';
  }
  
  // Siblings (side by side)
  if (siblings.length > 0) {
    const sibIds = [...new Set(siblings.map(r => r.to))];
    const sibNodes = sibIds.map(sibId => {
      const sibling = allPersons.find(p => p.id === sibId);
      return sibling ? createTreeNode(sibling) : '';
    }).filter(Boolean);
    html += createLevel(sibNodes, 'siblings', 'Geschwister');
  }
  
  // Children (side by side)
  if (children.length > 0) {
    const childNodes = children.map(rel => {
      const child = allPersons.find(p => p.id === rel.to);
      return child ? createTreeNode(child) : '';
    }).filter(Boolean);
    html += createLevel(childNodes, 'children', 'Kinder');
  }
  
  if (grandparents.length === 0 && parents.length === 0 && siblings.length === 0 && children.length === 0) {
    html = '<h3>🌳 Stammbaum</h3><p style="color: var(--text-secondary); font-size: 0.85rem;">Keine Familienbeziehungen gefunden</p>';
  }
  
  html += '</div>';
  container.innerHTML = html;
}

// Get person icon based on species
function getPersonIcon(person) {
  const species = (person.species || '').toLowerCase();
  if (species.includes('elf') || species.includes('elb')) return '🧝';
  if (species.includes('dwarf') || species.includes('zwerg')) return '🧙';
  if (species.includes('hobbit')) return '🧚';
  if (person.gender === 'female') return '👩';
  if (person.gender === 'male') return '👨';
  return '👤';
}

// Add selected house from dropdown to edit field
function addSelectedHouse() {
  const houseSelect = document.getElementById('houseSelect');
  const editHouses = document.getElementById('editHouses');
  
  if (!houseSelect || !editHouses) return;
  
  const selectedHouse = houseSelect.value.trim();
  if (!selectedHouse) return;
  
  // Get current houses, trim each, filter empty
  const currentHouses = editHouses.value.split(',')
    .map(h => h.trim())
    .filter(h => h);
  
  if (!currentHouses.includes(selectedHouse)) {
    currentHouses.push(selectedHouse);
  }
  
  // Rebuild with trimmed values
  editHouses.value = currentHouses.join(', ');
  houseSelect.value = '';
  
  showToast(`House "${selectedHouse}" hinzugefügt`, 'success');
}

// Trim houses on blur (auto-clean spaces)
function trimHousesOnBlur() {
  const editHouses = document.getElementById('editHouses');
  if (!editHouses) return;
  
  const trimmed = editHouses.value.split(',')
    .map(h => h.trim())
    .filter(h => h)
    .join(', ');
  
  editHouses.value = trimmed;
}

// Source Links Editor Functions
function addSourceLink() {
  const container = document.getElementById('sourceLinksEditor');
  if (!container) return;
  
  const newLink = document.createElement('div');
  newLink.className = 'source-link-row';
  newLink.style.cssText = 'display: flex; gap: 0.5rem; margin-bottom: 0.5rem;';
  newLink.innerHTML = `
    <input type="text" placeholder="Label" class="source-label" style="flex: 1; padding: 0.4rem;">
    <input type="text" placeholder="URL" class="source-url" style="flex: 2; padding: 0.4rem;">
    <button type="button" class="btn btn-small btn-danger" onclick="removeSourceLink(this)" style="padding: 0.4rem;">🗑️</button>
  `;
  
  // Insert before the "Add" button
  const addButton = container.querySelector('button[onclick="addSourceLink()"]');
  container.insertBefore(newLink, addButton);
}

function removeSourceLink(button) {
  const row = button.closest('.source-link-row');
  if (row) row.remove();
}

function getSourceLinks() {
  const rows = document.querySelectorAll('.source-link-row');
  const links = [];
  
  rows.forEach(row => {
    const label = row.querySelector('.source-label')?.value.trim();
    const url = row.querySelector('.source-url')?.value.trim();
    
    if (label && url) {
      links.push({ label, url });
    }
  });
  
  return links;
}

// Render relations
function renderRelations(personId) {
  const view = document.getElementById('relationsView');
  
  const incoming = allRelations.filter(r => r.to === personId);
  const outgoing = allRelations.filter(r => r.from === personId);
  
  let html = '<h3>Eingehende Beziehungen</h3><ul class="relation-list">';
  
  if (incoming.length === 0) {
    html += '<li style="color: var(--text-secondary);">Keine eingehenden Beziehungen</li>';
  } else {
    incoming.forEach(rel => {
      const fromPerson = allPersons.find(p => p.id === rel.from);
      html += `
        <li class="relation-item">
          <div style="cursor: pointer;" onclick="navigateToPersonById('${rel.from}')">
            <span class="relation-type">${rel.type}</span>
            <span class="relation-target">von ${fromPerson?.name || 'Unknown'}</span>
          </div>
          <div class="relation-actions">
            <button class="btn btn-small btn-danger" onclick="deleteRelation('${rel.id}')">🗑️</button>
          </div>
        </li>
      `;
    });
  }
  
  html += '</ul><h3>Ausgehende Beziehungen</h3><ul class="relation-list">';
  
  if (outgoing.length === 0) {
    html += '<li style="color: var(--text-secondary);">Keine ausgehenden Beziehungen</li>';
  } else {
    outgoing.forEach(rel => {
      const toPerson = allPersons.find(p => p.id === rel.to);
      html += `
        <li class="relation-item">
          <div style="cursor: pointer;" onclick="navigateToPersonById('${rel.to}')">
            <span class="relation-type">${rel.type}</span>
            <span class="relation-target">zu ${toPerson?.name || 'Unknown'}</span>
          </div>
          <div class="relation-actions">
            <button class="btn btn-small btn-danger" onclick="deleteRelation('${rel.id}')">🗑️</button>
          </div>
        </li>
      `;
    });
  }
  
  html += `
    </ul>
    <div class="add-relation-form">
      <h3>➕ Neue Beziehung hinzufügen</h3>
      <div class="form-group">
        <label>Typ</label>
        <select id="newRelationType">
          <option value="biological_parent">Biological Parent</option>
          <option value="spouse">Spouse</option>
          <option value="sibling">Sibling</option>
          <option value="child">Child</option>
        </select>
      </div>
      <div class="form-group">
        <label>Andere Person (Name suchen)</label>
        <div class="dropdown-container" style="position: relative;">
          <input type="text" id="newRelationPerson" placeholder="Name eingeben..." oninput="searchPersonForRelation(this.value)" style="width: 100%;">
          <div class="dropdown-results" id="relationPersonResults" style="position: absolute; width: 100%;"></div>
        </div>
        <input type="hidden" id="newRelationPersonId">
      </div>
      <div class="btn-group">
        <button class="btn btn-primary" onclick="addRelation()">Hinzufügen</button>
      </div>
    </div>
  `;
  
  view.innerHTML = html;
}

// Search person for relation
function searchPersonForRelation(query) {
  const results = document.getElementById('relationPersonResults');
  if (!results) {
    console.error('relationPersonResults element not found');
    return;
  }
  
  // Trim query and check length
  query = query.trim();
  if (query.length < 1) {
    results.classList.remove('show');
    return;
  }
  
  const queryNormalized = normalizeText(query);
  
  // Search by name OR ID (with umlaut normalization)
  const matches = allPersons.filter(p => {
    const nameMatch = normalizeText(p.name).includes(queryNormalized);
    const idMatch = p.id.toLowerCase().includes(queryNormalized.toLowerCase());
    return nameMatch || idMatch;
  }).slice(0, 15);
  
  console.log(`Search "${query}": ${matches.length} matches, showing: ${matches.length > 0}`);
  
  if (matches.length === 0) {
    results.innerHTML = '<div class="dropdown-item" style="color: var(--text-secondary);">Keine Treffer</div>';
  } else {
    results.innerHTML = matches.map((p, idx) => `
      <div class="dropdown-item" data-idx="${idx}" onclick="selectPersonForRelation('${p.id}', '${p.name.replace(/'/g, "\\\\\\\\'")}')">
        <strong>${p.name}</strong><br>
        <small style="color: var(--text-secondary);">${p.species || 'Unknown'} • ${p.id}</small>
      </div>
    `).join('');
  }
  
  results.classList.add('show');
  console.log('Dropdown shown:', results.classList.contains('show'));
}

// Select person for relation
function selectPersonForRelation(id, name) {
  document.getElementById('newRelationPerson').value = name;
  document.getElementById('newRelationPersonId').value = id;
  document.getElementById('relationPersonResults').classList.remove('show');
}

// Add relation - client-only (no backend)
async function addRelation() {
  const type = document.getElementById('newRelationType').value;
  const otherId = document.getElementById('newRelationPersonId').value;
  
  if (!otherId) {
    showToast('Bitte Person auswählen', 'warning');
    return;
  }
  
  const newRelation = {
    id: crypto.randomUUID(),
    type,
    from: selectedPerson.id,
    to: otherId,
    attributes: { date: null }
  };
  
  // Export as JSON file
  const filename = `${newRelation.id}.json`;
  const blob = new Blob([JSON.stringify(newRelation, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  
  // Update local data
  allRelations.push(newRelation);
  renderRelations(selectedPerson.id);
  
  showToast(`✓ Export: ${filename} — Im Relations-Ordner speichern!`, 'success');
}

// Delete relation - client-only
async function deleteRelation(relationId) {
  if (!confirm('Beziehung wirklich löschen?\\n\\n⚠️ Datei muss manuell im Relations-Ordner gelöscht werden!')) return;
  
  // Remove from local data only
  allRelations = allRelations.filter(r => r.id !== relationId);
  renderRelations(selectedPerson.id);
  
  showToast('⚠️ Beziehung lokal entfernt — Datei manuell löschen!', 'warning');
}

// Navigate to person by ID (from relations)
function navigateToPersonById(personId) {
  const person = allPersons.find(p => p.id === personId);
  if (person) {
    navigateToPerson(person);
  } else {
    showToast(`Person nicht gefunden: ${personId}`, 'warning');
  }
}

// Search persons
document.getElementById('personSearch').addEventListener('input', (e) => {
  const query = e.target.value;
  
  const filtered = allPersons.filter(p => {
    const nameMatch = normalizeText(p.name).includes(normalizeText(query));
    const idMatch = p.id.toLowerCase().includes(query.toLowerCase());
    return nameMatch || idMatch;
  });
  
  renderPersonList(filtered);
});

// Initialize
initDatasetSelector();
loadPersons();
// loadHouseDefinitions() wird in renderDetailView() aufgerufen wenn Formular angezeigt wird

// Person Schema for validation
const PERSON_SCHEMA = {
  required: ['id', 'name', 'gender', 'species', 'birth', 'death', 'houses', 'sourceLinks', 'metadata'],
  properties: {
    id: { type: 'string', pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i },
    name: { type: 'string', minLength: 1, maxLength: 200 },
    gender: { type: 'string', enum: ['male', 'female', 'unknown'] },
    species: { type: 'string', minLength: 1 },
    birth: { type: 'object', required: ['era'], properties: { era: { type: 'string' }, year: { type: ['integer', 'null'] } } },
    death: { type: ['object', 'null'], properties: { era: { type: 'string' }, year: { type: ['integer', 'null'] } } },
    houses: { type: 'array', items: { type: 'string', minLength: 1 } },
    sourceLinks: { type: 'array', items: { type: 'object', required: ['label', 'url'] } },
    metadata: { type: 'object', required: ['description'], properties: { description: { type: 'string' } } }
  }
};

// Validate person against schema
function validatePerson(person) {
  const errors = [];
  const warnings = [];
  const info = [];
  
  // Check required fields
  PERSON_SCHEMA.required.forEach(field => {
    if (!(field in person)) {
      errors.push(`Fehlendes Feld: "${field}"`);
    }
  });
  
  // Validate ID format
  if (person.id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(person.id)) {
    errors.push(`Ungültige ID: "${person.id}" (muss UUID v4 sein)`);
  }
  
  // Validate name
  if (!person.name || person.name.trim().length === 0) {
    errors.push('Name darf nicht leer sein');
  } else if (person.name.length > 200) {
    warnings.push(`Name ist sehr lang (${person.name.length} Zeichen, max 200)`);
  }
  
  // Validate gender
  if (person.gender && !['male', 'female', 'unknown'].includes(person.gender)) {
    errors.push(`Ungültiger Gender: "${person.gender}" (erlaubt: male, female, unknown)`);
  }
  
  // Validate species
  if (!person.species || person.species.trim().length === 0) {
    errors.push('Species darf nicht leer sein');
  }
  
  // Validate birth
  if (person.birth) {
    if (!person.birth.era) {
      warnings.push('Birth: Era fehlt');
    }
    if (person.birth.year !== null && person.birth.year !== undefined) {
      if (typeof person.birth.year !== 'number' || person.birth.year < -50000 || person.birth.year > 50000) {
        warnings.push(`Birth: Jahr ${person.birth.year} ist außerhalb des erwarteten Bereichs`);
      }
    }
  } else {
    warnings.push('Birth: fehlt vollständig');
  }
  
  // Validate death
  if (person.death !== null && person.death !== undefined) {
    if (!person.death.era) {
      warnings.push('Death: Era fehlt');
    }
  }
  
  // Validate houses
  if (!person.houses || !Array.isArray(person.houses)) {
    errors.push('Houses: muss ein Array sein');
  } else if (person.houses.length === 0) {
    warnings.push('Houses: ist leer (empfohlen: mindestens ein House)');
  } else {
    person.houses.forEach((h, i) => {
      if (!h || typeof h !== 'string' || h.trim().length === 0) {
        errors.push(`Houses[${i}]: ist leer oder ungültig`);
      }
    });
  }
  
  // Validate sourceLinks
  if (!person.sourceLinks || !Array.isArray(person.sourceLinks)) {
    errors.push('SourceLinks: muss ein Array sein');
  } else {
    person.sourceLinks.forEach((sl, i) => {
      if (!sl.label || !sl.url) {
        errors.push(`SourceLinks[${i}]: fehlt label oder url`);
      } else if (!sl.url.startsWith('http://') && !sl.url.startsWith('https://')) {
        warnings.push(`SourceLinks[${i}]: URL sollte mit http:// oder https:// beginnen`);
      }
    });
  }
  
  // Validate metadata
  if (!person.metadata) {
    errors.push('Metadata: fehlt vollständig');
  } else if (!person.metadata.description || person.metadata.description.trim().length === 0) {
    errors.push('Metadata.description: darf nicht leer sein');
  }
  
  // Additional checks (info level)
  if (!person.portraitUrl) {
    info.push('Kein Portrait URL angegeben');
  }
  
  if (person.yOffset !== undefined && person.yOffset !== null) {
    if (person.yOffset % 72 !== 0) {
      warnings.push(`yOffset (${person.yOffset}) ist kein Vielfaches von 72`);
    }
  }
  
  return { errors, warnings, info, isValid: errors.length === 0 };
}

// Render validation results
function renderValidationResults(person) {
  const container = document.getElementById('validationResults');
  if (!container) return;
  
  const { errors, warnings, info, isValid } = validatePerson(person);
  
  let html = '';
  
  if (isValid) {
    html += '<div class="validation-status valid">✅ Alle Attribute korrekt</div>';
  } else {
    html += `<div class="validation-status invalid">❌ ${errors.length} Fehler gefunden</div>`;
  }
  
  if (errors.length > 0) {
    html += '<div class="validation-section"><strong>🔴 Fehler:</strong><ul class="validation-list">';
    errors.forEach(e => html += `<li>${e}</li>`);
    html += '</ul></div>';
  }
  
  if (warnings.length > 0) {
    html += '<div class="validation-section"><strong>🟠 Warnungen:</strong><ul class="validation-list">';
    warnings.forEach(w => html += `<li>${w}</li>`);
    html += '</ul></div>';
  }
  
  if (info.length > 0) {
    html += '<div class="validation-section"><strong>🔵 Info:</strong><ul class="validation-list">';
    info.forEach(i => html += `<li>${i}</li>`);
    html += '</ul></div>';
  }
  
  // Show schema summary
  html += `
    <div class="validation-section">
      <strong>📋 Schema Info:</strong>
      <ul class="validation-list" style="font-size: 0.85rem; color: var(--text-secondary);">
        <li>Required: ${PERSON_SCHEMA.required.join(', ')}</li>
        <li>Person ID: UUID v4 Format</li>
        <li>Houses: Array (min. 1 Eintrag empfohlen)</li>
        <li>SourceLinks: Array mit label + url</li>
      </ul>
    </div>
  `;
  
  container.innerHTML = html;
}

