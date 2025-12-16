// DOM Syringe - Popup Script
// Handles UI interactions and state management

// State
let copyItems = [];
let currentItem = null;
let editingIndex = -1;
let pendingVariableName = null;
let pageInfo = { url: '', title: '' };

// DOM Elements
const listView = document.getElementById('list-view');
const editorView = document.getElementById('editor-view');
const itemsList = document.getElementById('items-list');
const emptyState = document.getElementById('empty-state');
const variablesList = document.getElementById('variables-list');
const variablesEmpty = document.getElementById('variables-empty');
const templateEditor = document.getElementById('template-editor');
const templatePreview = document.getElementById('template-preview');
const itemNameInput = document.getElementById('item-name');
const editorTitle = document.getElementById('editor-title');
const variableSuggestions = document.getElementById('variable-suggestions');
const toast = document.getElementById('toast');

// Buttons
const newItemBtn = document.getElementById('new-item-btn');
const backBtn = document.getElementById('back-btn');
const addVariableBtn = document.getElementById('add-variable-btn');
const saveItemBtn = document.getElementById('save-item-btn');
const deleteItemBtn = document.getElementById('delete-item-btn');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Load saved items
  const storage = await chrome.storage.sync.get('copyItems');
  copyItems = storage.copyItems || [];

  // Get current page info
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      pageInfo = { url: tab.url, title: tab.title };
    }
  } catch (e) {
    console.log('Could not get page info:', e);
  }

  // Check for any pending selections from picker
  await checkPendingSelection();

  // Render list
  renderItemsList();

  // Set up event listeners
  setupEventListeners();

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener(handleMessage);
}

// Check if there's a pending selection from picker (popup was closed during pick)
async function checkPendingSelection() {
  try {
    const { lastSelection, pendingPicker } = await chrome.storage.local.get(['lastSelection', 'pendingPicker']);

    // If there's a recent selection (within last 30 seconds)
    if (lastSelection && Date.now() - lastSelection.timestamp < 30000) {
      // Find or create the item being edited
      const { editingItemIndex } = await chrome.storage.local.get('editingItemIndex');

      if (editingItemIndex !== undefined && editingItemIndex >= 0) {
        // We were editing an existing item
        editingIndex = editingItemIndex;
        currentItem = JSON.parse(JSON.stringify(copyItems[editingIndex]));
      } else if (editingItemIndex === -1) {
        // We were creating a new item
        const { editingItemDraft } = await chrome.storage.local.get('editingItemDraft');
        currentItem = editingItemDraft || { name: '', template: '', variables: {} };
        editingIndex = -1;
      }

      if (currentItem) {
        // Apply the selection
        currentItem.variables[lastSelection.variableName] = lastSelection.selector;

        // Clear the pending selection
        await chrome.storage.local.remove('lastSelection');

        // Show editor with the updated item
        showEditorView();
        itemNameInput.value = currentItem.name;
        templateEditor.value = currentItem.template;
        renderVariables();
        updatePreview();
        return;
      }
    }

    // Clear old data
    await chrome.storage.local.remove(['lastSelection', 'pendingPicker', 'editingItemIndex', 'editingItemDraft']);
  } catch (e) {
    console.log('Error checking pending selection:', e);
  }
}

function setupEventListeners() {
  newItemBtn.addEventListener('click', () => openEditor());
  backBtn.addEventListener('click', () => showListView());
  addVariableBtn.addEventListener('click', () => addVariable());
  saveItemBtn.addEventListener('click', () => saveItem());
  deleteItemBtn.addEventListener('click', () => deleteItem());
  templateEditor.addEventListener('input', handleEditorInput);
  templateEditor.addEventListener('keydown', handleEditorKeydown);
  templateEditor.addEventListener('blur', () => hideSuggestions());
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.editor-wrapper')) {
      hideSuggestions();
    }
  });
}

// Message handler for content script
function handleMessage(message, sender, sendResponse) {
  if (message.type === 'ELEMENT_SELECTED') {
    handleElementSelected(message);
  } else if (message.type === 'PICKER_CANCELLED') {
    pendingVariableName = null;
  }
}

// Handle element selection from picker
function handleElementSelected(data) {
  if (!currentItem || !pendingVariableName) return;

  // Update variable with selector and preview value
  currentItem.variables[pendingVariableName] = data.selector;

  // Re-render variables
  renderVariables();
  updatePreview();

  pendingVariableName = null;
}

// Render items list
function renderItemsList() {
  itemsList.innerHTML = '';

  if (copyItems.length === 0) {
    emptyState.style.display = 'block';
    itemsList.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  itemsList.style.display = 'flex';

  copyItems.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-info">
        <div class="item-name">${escapeHtml(item.name)}</div>
        <div class="item-meta">${Object.keys(item.variables || {}).length} variables</div>
      </div>
      <span class="item-arrow">›</span>
    `;
    card.addEventListener('click', () => openEditor(index));
    itemsList.appendChild(card);
  });
}

// Open editor view
function openEditor(index = -1) {
  editingIndex = index;

  if (index >= 0) {
    // Editing existing item
    currentItem = JSON.parse(JSON.stringify(copyItems[index]));
    editorTitle.textContent = 'Edit Copy Item';
    editorView.classList.add('editing');
  } else {
    // Creating new item
    currentItem = {
      name: '',
      template: '',
      variables: {}
    };
    editorTitle.textContent = 'New Copy Item';
    editorView.classList.remove('editing');
  }

  // Populate form
  itemNameInput.value = currentItem.name;
  templateEditor.value = currentItem.template;

  renderVariables();
  updatePreview();
  showEditorView();
}

// Render variables list
async function renderVariables() {
  const vars = Object.entries(currentItem.variables || {});

  if (vars.length === 0) {
    variablesEmpty.style.display = 'block';
    variablesList.style.display = 'none';
    return;
  }

  variablesEmpty.style.display = 'none';
  variablesList.style.display = 'flex';
  variablesList.innerHTML = '';

  // Fetch all variable values in parallel
  const valuePromises = vars.map(async ([name, selector]) => {
    const value = await getVariablePreview(selector);
    return [name, selector, value];
  });

  const varsWithValues = await Promise.all(valuePromises);

  varsWithValues.forEach(([name, selector, value]) => {
    const item = document.createElement('div');
    item.className = 'variable-item';

    const displayValue = value || '[No value - pick element]';
    const hasValue = value && value !== '[No Content]' && value !== '[No Element]';

    item.innerHTML = `
      <div class="variable-name">
        <span>{</span>
        <input type="text" value="${escapeHtml(name)}" data-original="${escapeHtml(name)}" />
        <span>}</span>
      </div>
      <div class="variable-value ${hasValue ? 'has-value' : ''}">${escapeHtml(displayValue.substring(0, 40))}${displayValue.length > 40 ? '...' : ''}</div>
      <div class="variable-actions">
        <button class="repick-btn" data-var="${escapeHtml(name)}" title="Re-pick element">🎯</button>
        <button class="delete-btn" data-var="${escapeHtml(name)}" title="Delete variable">✕</button>
      </div>
    `;

    // Variable name change
    const nameInput = item.querySelector('input');
    nameInput.addEventListener('change', (e) => {
      const oldName = e.target.dataset.original;
      const newName = e.target.value.trim();
      if (newName && newName !== oldName) {
        renameVariable(oldName, newName);
      }
    });

    // Re-pick button
    item.querySelector('.repick-btn').addEventListener('click', (e) => {
      const varName = e.target.dataset.var;
      startPicker(varName);
    });

    // Delete button
    item.querySelector('.delete-btn').addEventListener('click', (e) => {
      const varName = e.target.dataset.var;
      deleteVariable(varName);
    });

    variablesList.appendChild(item);
  });
}

// Get variable preview value from page
async function getVariablePreview(selector) {
  if (!selector) return null;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return null;

    // Check if we can access this tab
    if (!canAccessTab(tab)) {
      return '[Cannot access this page]';
    }

    // Ensure content script is loaded
    await ensureContentScriptLoaded(tab.id);

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'GET_ELEMENT_VALUE',
      selector
    });
    return response?.value || null;
  } catch (e) {
    console.log('Could not get variable preview:', e);
    return '[Error getting value]';
  }
}

// Check if we can access a tab (not chrome://, edge://, etc.)
function canAccessTab(tab) {
  if (!tab.url) return false;
  const restrictedProtocols = ['chrome://', 'chrome-extension://', 'edge://', 'about:', 'moz-extension://'];
  return !restrictedProtocols.some(protocol => tab.url.startsWith(protocol));
}

// Ensure content script is loaded on the tab
async function ensureContentScriptLoaded(tabId) {
  try {
    // Try to ping the content script
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
  } catch (e) {
    // Content script not loaded, inject it
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/content.js']
      });
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ['content/content.css']
      });
      // Give it a moment to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (injectError) {
      console.log('Could not inject content script:', injectError);
      throw injectError;
    }
  }
}

// Add new variable
async function addVariable() {
  const varCount = Object.keys(currentItem.variables || {}).length;
  const varName = `var${varCount + 1}`;

  // Start picker with new variable name
  startPicker(varName);
}

// Start element picker
async function startPicker(variableName) {
  pendingVariableName = variableName;

  // Initialize variable if new
  if (!currentItem.variables[variableName]) {
    currentItem.variables[variableName] = '';
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      alert('No active tab found.');
      return;
    }

    // Check if we can access this tab
    if (!canAccessTab(tab)) {
      alert('Cannot use element picker on this page. Please navigate to a regular webpage (not a browser internal page).');
      return;
    }

    // Save current editing state for recovery if popup closes
    await chrome.storage.local.set({
      editingItemIndex: editingIndex,
      editingItemDraft: currentItem
    });

    // Ensure content script is loaded
    await ensureContentScriptLoaded(tab.id);

    await chrome.tabs.sendMessage(tab.id, {
      type: 'START_PICKER',
      variableName
    });
    // Don't close popup - let user see the picker and use keyboard to select
  } catch (e) {
    console.error('Failed to start picker:', e);
    // Clear saved state since picker failed
    await chrome.storage.local.remove(['editingItemIndex', 'editingItemDraft']);
    alert('Could not start element picker. Please refresh the page and try again.');
  }
}

// Rename variable
function renameVariable(oldName, newName) {
  if (currentItem.variables[oldName] !== undefined) {
    currentItem.variables[newName] = currentItem.variables[oldName];
    delete currentItem.variables[oldName];

    // Update template
    currentItem.template = currentItem.template.replace(
      new RegExp(`\\{${oldName}\\}`, 'g'),
      `{${newName}}`
    );
    templateEditor.value = currentItem.template;

    renderVariables();
    updatePreview();
  }
}

// Delete variable
function deleteVariable(varName) {
  delete currentItem.variables[varName];
  renderVariables();
  updatePreview();
}

// Update template preview with live values
async function updatePreview() {
  const template = templateEditor.value;
  currentItem.template = template;

  if (!template) {
    templatePreview.innerHTML = '<em>Preview will appear here...</em>';
    return;
  }

  // Fetch actual variable values from page
  const values = {
    CURRENT_PAGE_URL: pageInfo.url || 'https://example.com',
    CURRENT_PAGE_TITLE: pageInfo.title || 'Page Title'
  };

  // Get live values for custom variables
  for (const [varName, selector] of Object.entries(currentItem.variables || {})) {
    if (selector) {
      const value = await getVariablePreview(selector);
      values[varName] = value || `[${varName}]`;
    } else {
      values[varName] = `[${varName}]`;
    }
  }

  // Replace variables in template and wrap with styled spans
  let result = escapeHtml(template);
  for (const [varName, value] of Object.entries(values)) {
    const displayValue = value.startsWith('[') ? value : `<span class="var-value">${escapeHtml(value.substring(0, 50))}${value.length > 50 ? '...' : ''}</span>`;
    result = result.replace(new RegExp(`\\{${varName}\\}`, 'g'), displayValue);
  }

  // Parse Markdown-style links: [text](url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Convert newlines to <br>
  result = result.replace(/\n/g, '<br>');

  templatePreview.innerHTML = result || '<em>Preview will appear here...</em>';
}

// Parse template to HTML for copying (Markdown links only)
function parseTemplateToHtml(template) {
  let html = template;

  // Handle Markdown-style links: [text](url) -> <a href="url">text</a>
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Convert newlines to <br>
  html = html.replace(/\n/g, '<br>');

  return html;
}

// Save current item
async function saveItem() {
  const name = itemNameInput.value.trim();

  if (!name) {
    alert('Please enter a name for this copy item.');
    itemNameInput.focus();
    return;
  }

  currentItem.name = name;
  currentItem.template = templateEditor.value;

  if (editingIndex >= 0) {
    copyItems[editingIndex] = currentItem;
  } else {
    copyItems.push(currentItem);
  }

  await chrome.storage.sync.set({ copyItems });

  // Notify background to rebuild menu
  chrome.runtime.sendMessage({ type: 'REBUILD_MENU' });

  showListView();
  renderItemsList();
}

// Delete current item
async function deleteItem() {
  if (editingIndex < 0) return;

  if (!confirm('Are you sure you want to delete this copy item?')) return;

  copyItems.splice(editingIndex, 1);
  await chrome.storage.sync.set({ copyItems });

  // Notify background to rebuild menu
  chrome.runtime.sendMessage({ type: 'REBUILD_MENU' });

  showListView();
  renderItemsList();
}

// View switching
function showListView() {
  listView.classList.add('active');
  editorView.classList.remove('active');
  currentItem = null;
  editingIndex = -1;
}

function showEditorView() {
  listView.classList.remove('active');
  editorView.classList.add('active');
}

// Utility: Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============ Editor Autocomplete ============

let suggestionIndex = -1;
let currentSuggestions = [];

function handleEditorInput(e) {
  updatePreview();
  checkForVariableTrigger();
}

function handleEditorKeydown(e) {
  if (!variableSuggestions.classList.contains('active')) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    suggestionIndex = Math.min(suggestionIndex + 1, currentSuggestions.length - 1);
    updateSuggestionHighlight();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    suggestionIndex = Math.max(suggestionIndex - 1, 0);
    updateSuggestionHighlight();
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    if (suggestionIndex >= 0 && currentSuggestions[suggestionIndex]) {
      e.preventDefault();
      insertSuggestion(currentSuggestions[suggestionIndex]);
    }
  } else if (e.key === 'Escape') {
    hideSuggestions();
  }
}

function checkForVariableTrigger() {
  const cursorPos = templateEditor.selectionStart;
  const text = templateEditor.value;

  // Look backwards from cursor for an opening {
  let startPos = cursorPos - 1;
  while (startPos >= 0 && text[startPos] !== '{' && text[startPos] !== '}' && text[startPos] !== '\n') {
    startPos--;
  }

  if (startPos >= 0 && text[startPos] === '{') {
    const partialVar = text.substring(startPos + 1, cursorPos);

    // Don't show suggestions if there's a closing }
    if (partialVar.includes('}')) {
      hideSuggestions();
      return;
    }

    showSuggestions(partialVar, startPos);
  } else {
    hideSuggestions();
  }
}

function showSuggestions(filter, startPos) {
  // Get all available variables
  const allVars = [
    'CURRENT_PAGE_URL',
    'CURRENT_PAGE_TITLE',
    ...Object.keys(currentItem?.variables || {})
  ];

  // Filter by partial match
  const filtered = allVars.filter(v =>
    v.toLowerCase().includes(filter.toLowerCase())
  );

  if (filtered.length === 0) {
    hideSuggestions();
    return;
  }

  currentSuggestions = filtered;
  suggestionIndex = 0;

  // Position the dropdown
  const rect = templateEditor.getBoundingClientRect();
  const coords = getCaretCoordinates(templateEditor, startPos);

  variableSuggestions.style.top = `${coords.top + 20}px`;
  variableSuggestions.style.left = `${Math.min(coords.left, rect.width - 200)}px`;

  // Render suggestions
  variableSuggestions.innerHTML = filtered.map((varName, i) => `
    <div class="variable-suggestion ${i === 0 ? 'selected' : ''}" data-var="${varName}">
      <span class="var-name">{${varName}}</span>
      <span class="var-preview">${varName.startsWith('CURRENT_') ? 'built-in' : 'custom'}</span>
    </div>
  `).join('');

  // Add click handlers
  variableSuggestions.querySelectorAll('.variable-suggestion').forEach(el => {
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      insertSuggestion(el.dataset.var);
    });
  });

  variableSuggestions.classList.add('active');
}

function hideSuggestions() {
  variableSuggestions.classList.remove('active');
  currentSuggestions = [];
  suggestionIndex = -1;
}

function updateSuggestionHighlight() {
  variableSuggestions.querySelectorAll('.variable-suggestion').forEach((el, i) => {
    el.classList.toggle('selected', i === suggestionIndex);
  });
}

function insertSuggestion(varName) {
  const cursorPos = templateEditor.selectionStart;
  const text = templateEditor.value;

  // Find the { that started this suggestion
  let startPos = cursorPos - 1;
  while (startPos >= 0 && text[startPos] !== '{') {
    startPos--;
  }

  // Replace from { to cursor with the full variable
  const before = text.substring(0, startPos);
  const after = text.substring(cursorPos);
  const newText = before + '{' + varName + '}' + after;

  templateEditor.value = newText;

  // Position cursor after the inserted variable
  const newCursorPos = startPos + varName.length + 2;
  templateEditor.setSelectionRange(newCursorPos, newCursorPos);
  templateEditor.focus();

  hideSuggestions();
  updatePreview();
}

// Simple caret position calculator
function getCaretCoordinates(textarea, position) {
  const lines = textarea.value.substring(0, position).split('\n');
  const lineHeight = 20; // approximate
  const charWidth = 8; // approximate for monospace

  return {
    top: (lines.length - 1) * lineHeight,
    left: (lines[lines.length - 1].length) * charWidth
  };
}

// ============ Toast Notifications ============

function showToast(message, type = 'success') {
  toast.textContent = message;
  toast.className = `toast ${type} show`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

// Export showToast for use by background script
window.showToast = showToast;

