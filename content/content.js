// DOM Syringe - Content Script
// Handles element picking and DOM interaction

let isPickerActive = false;
let highlightedElement = null;
let pickerOverlay = null;
let currentVariableName = null;

// Styles for highlighted elements
const HIGHLIGHT_STYLE = {
  outline: '2px solid #4F46E5',
  outlineOffset: '2px',
  backgroundColor: 'rgba(79, 70, 229, 0.1)'
};

// Store original styles for restoration
const originalStyles = new Map();

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'PING':
      // Used to check if content script is loaded
      sendResponse({ success: true, loaded: true });
      break;
    case 'START_PICKER':
      startPicker(message.variableName);
      sendResponse({ success: true });
      break;
    case 'STOP_PICKER':
      stopPicker(true); // true = cancelled
      sendResponse({ success: true });
      break;
    case 'CONFIRM_SELECTION':
      // Confirm current highlighted element via keyboard shortcut
      if (isPickerActive && highlightedElement) {
        confirmSelection(highlightedElement);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, reason: 'No element highlighted' });
      }
      break;
    case 'GET_ELEMENT_VALUE':
      const value = getElementValue(message.selector);
      sendResponse({ value });
      break;
    case 'GET_PAGE_INFO':
      sendResponse({
        url: window.location.href,
        title: document.title
      });
      break;
    case 'CHECK_PICKER_STATUS':
      sendResponse({ isActive: isPickerActive, variableName: currentVariableName });
      break;
  }
  return true;
});

// Start element picker mode
function startPicker(variableName) {
  if (isPickerActive) {
    // Update variable name if picker already active
    currentVariableName = variableName;
    updatePickerOverlay();
    return;
  }

  isPickerActive = true;
  currentVariableName = variableName;
  createPickerOverlay(variableName);

  // Use capture phase to intercept events before page handlers
  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);

  // Store picker state for popup recovery
  chrome.storage.local.set({
    pendingPicker: {
      active: true,
      variableName: variableName,
      timestamp: Date.now()
    }
  });
}

// Stop element picker mode
function stopPicker(cancelled = false) {
  if (!isPickerActive) return;

  isPickerActive = false;
  currentVariableName = null;
  removePickerOverlay();
  removeHighlight();

  document.removeEventListener('mousemove', handleMouseMove, true);
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('keydown', handleKeyDown, true);

  // Clear picker state
  chrome.storage.local.remove('pendingPicker');

  if (cancelled) {
    chrome.runtime.sendMessage({ type: 'PICKER_CANCELLED' });
  }
}

// Create overlay UI for picker mode
function createPickerOverlay(variableName) {
  pickerOverlay = document.createElement('div');
  pickerOverlay.id = 'dom-syringe-picker-overlay';
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const confirmKey = isMac ? '⌘⇧E' : 'Ctrl+Shift+E';

  pickerOverlay.innerHTML = `
    <div class="ds-picker-header">
      <span class="ds-picker-icon">💉</span>
      <span class="ds-picker-title">DOM Syringe - Selecting: <strong>${variableName || 'element'}</strong></span>
      <span class="ds-picker-hint">Hover & press <strong>${confirmKey}</strong> to select • <strong>Esc</strong> to cancel</span>
    </div>
  `;
  document.body.appendChild(pickerOverlay);
}

// Update picker overlay text
function updatePickerOverlay() {
  if (pickerOverlay) {
    const titleEl = pickerOverlay.querySelector('.ds-picker-title strong');
    if (titleEl) {
      titleEl.textContent = currentVariableName || 'element';
    }
  }
}

// Remove picker overlay
function removePickerOverlay() {
  if (pickerOverlay) {
    pickerOverlay.remove();
    pickerOverlay = null;
  }
}

// Handle mouse movement for highlighting
function handleMouseMove(event) {
  if (!isPickerActive) return;

  const element = event.target;

  // Ignore our own overlay
  if (element.closest('#dom-syringe-picker-overlay')) return;

  // Remove previous highlight
  removeHighlight();

  // Highlight new element
  highlightElement(element);
}

// Handle click - prevent default but don't select (use keyboard instead)
function handleClick(event) {
  if (!isPickerActive) return;

  const element = event.target;

  // Ignore our own overlay
  if (element.closest('#dom-syringe-picker-overlay')) return;

  // Prevent click from triggering page actions while picker is active
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  return false;
}

// Handle keyboard events
function handleKeyDown(event) {
  if (!isPickerActive) return;

  // ESC to cancel
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    stopPicker(true);
    return;
  }

  // Ctrl/Cmd + Shift + E to CONFIRM selection
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'e') {
    event.preventDefault();
    event.stopPropagation();

    if (highlightedElement) {
      confirmSelection(highlightedElement);
    }
    return;
  }
}

// Confirm the currently highlighted element as selection
function confirmSelection(element) {
  if (!element) return;

  // Generate selector for element
  const selector = generateSelector(element);
  const text = getDeepText(element);

  // Store the selection in local storage for popup to retrieve
  chrome.storage.local.set({
    lastSelection: {
      variableName: currentVariableName,
      selector,
      text,
      tagName: element.tagName.toLowerCase(),
      timestamp: Date.now()
    }
  });

  // Send selected element info via runtime message
  chrome.runtime.sendMessage({
    type: 'ELEMENT_SELECTED',
    variableName: currentVariableName,
    selector,
    text,
    tagName: element.tagName.toLowerCase()
  });

  stopPicker(false);
}

// Get deep text content from an element
function getDeepText(element) {
  if (!element) return '[No Element]';

  // Get text content, trimmed
  const text = element.textContent?.trim();

  if (text && text.length > 0) {
    // Truncate if very long for preview
    return text.length > 200 ? text.substring(0, 200) + '...' : text;
  }

  // Check for value attribute (inputs, textareas, etc)
  if (element.value) {
    return element.value.trim();
  }

  // Check for alt text (images)
  if (element.alt) {
    return element.alt.trim();
  }

  // Check for title attribute
  if (element.title) {
    return element.title.trim();
  }

  // Check for placeholder
  if (element.placeholder) {
    return `[Placeholder: ${element.placeholder}]`;
  }

  return '[No Content]';
}

// Highlight an element
function highlightElement(element) {
  // Store original styles
  originalStyles.set(element, {
    outline: element.style.outline,
    outlineOffset: element.style.outlineOffset,
    backgroundColor: element.style.backgroundColor
  });

  // Apply highlight styles
  element.style.outline = HIGHLIGHT_STYLE.outline;
  element.style.outlineOffset = HIGHLIGHT_STYLE.outlineOffset;
  element.style.backgroundColor = HIGHLIGHT_STYLE.backgroundColor;

  highlightedElement = element;
}

// Remove highlight from current element
function removeHighlight() {
  if (highlightedElement && originalStyles.has(highlightedElement)) {
    const original = originalStyles.get(highlightedElement);
    highlightedElement.style.outline = original.outline;
    highlightedElement.style.outlineOffset = original.outlineOffset;
    highlightedElement.style.backgroundColor = original.backgroundColor;
    originalStyles.delete(highlightedElement);
  }
  highlightedElement = null;
}

// Generate a CSS selector for an element
function generateSelector(element) {
  // Try ID first
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  // Try unique class combination
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\s+/).filter(c => c);
    if (classes.length > 0) {
      const classSelector = '.' + classes.map(c => CSS.escape(c)).join('.');
      if (document.querySelectorAll(classSelector).length === 1) {
        return classSelector;
      }
    }
  }

  // Build path from root
  const path = [];
  let current = element;

  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector = `#${CSS.escape(current.id)}`;
      path.unshift(selector);
      break;
    }

    // Add nth-child if needed for uniqueness
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        child => child.tagName === current.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    current = parent;
  }

  return path.join(' > ');
}

// Get text content from a selector
function getElementValue(selector) {
  try {
    const element = document.querySelector(selector);
    return getDeepText(element);
  } catch {
    return '[Invalid Selector]';
  }
}

