// DOM Syringe - Background Service Worker
// Handles context menu and clipboard operations

const MENU_PARENT_ID = 'dom-syringe-parent';
let menuBuilding = false;

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('DOM Syringe installed');
  buildContextMenu();
});

// Also build menu on startup (service worker wake)
chrome.runtime.onStartup.addListener(() => {
  buildContextMenu();
});

// Rebuild menu when storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.copyItems) {
    buildContextMenu();
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  if (command === 'confirm-selection') {
    // Send confirm command to content script - it will handle the selection
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'CONFIRM_SELECTION' });
    } catch (e) {
      console.log('Could not send confirm selection:', e);
    }
  }
});

// Build context menu from saved copy items
async function buildContextMenu() {
  // Prevent concurrent builds
  if (menuBuilding) return;
  menuBuilding = true;

  try {
    // Remove all existing menu items first
    await chrome.contextMenus.removeAll();

    // Create parent menu
    chrome.contextMenus.create({
      id: MENU_PARENT_ID,
      title: 'DOM Syringe',
      contexts: ['page', 'selection']
    });

    // Get saved copy items
    const { copyItems = [] } = await chrome.storage.sync.get('copyItems');

    if (copyItems.length === 0) {
      chrome.contextMenus.create({
        id: 'no-items',
        parentId: MENU_PARENT_ID,
        title: '(No copy items yet)',
        enabled: false,
        contexts: ['page', 'selection']
      });
    } else {
      copyItems.forEach((item, index) => {
        chrome.contextMenus.create({
          id: `copy-item-${index}`,
          parentId: MENU_PARENT_ID,
          title: item.name,
          contexts: ['page', 'selection']
        });
      });
    }
  } catch (error) {
    console.error('Failed to build context menu:', error);
  } finally {
    menuBuilding = false;
  }
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!info.menuItemId.toString().startsWith('copy-item-')) return;

  const index = parseInt(info.menuItemId.toString().replace('copy-item-', ''));
  const { copyItems = [] } = await chrome.storage.sync.get('copyItems');
  const item = copyItems[index];

  if (!item) return;

  // Execute content script to get variable values and copy to clipboard
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractAndCopy,
      args: [item]
    });

    if (results && results[0] && results[0].result) {
      // Show notification or badge
      console.log('Copied:', results[0].result);
    }
  } catch (error) {
    console.error('Failed to extract and copy:', error);
  }
});

// Function injected into page to extract variables and copy
function extractAndCopy(copyItem) {
  const { template, variables } = copyItem;

  // Helper: Get deep text content from element
  function getDeepText(element) {
    if (!element) return '[No Element]';

    // Get text content, trimmed
    const text = element.textContent?.trim();

    if (text && text.length > 0) {
      return text;
    }

    // Check for value attribute (inputs, etc)
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

    return '[No Content]';
  }

  // Helper: Parse Markdown links to HTML
  function parseToHtml(tmpl) {
    let html = tmpl;

    // Handle Markdown-style links: [text](url) -> <a href="url">text</a>
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Convert newlines to <br>
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  // Helper: Strip HTML tags for plain text
  function stripTags(html) {
    const div = document.createElement('div');
    div.innerHTML = html;

    // Convert links to "text (url)" format for plain text
    div.querySelectorAll('a').forEach(a => {
      a.textContent = `${a.textContent} (${a.href})`;
    });

    // Convert <br> to newlines
    div.querySelectorAll('br').forEach(br => {
      br.replaceWith('\n');
    });

    return div.textContent || div.innerText || '';
  }

  // Extract variable values from DOM
  const values = {};

  for (const [varName, selector] of Object.entries(variables || {})) {
    try {
      const element = document.querySelector(selector);
      values[varName] = getDeepText(element);
    } catch (e) {
      values[varName] = '[Invalid Selector]';
    }
  }

  // Add built-in variables
  values['CURRENT_PAGE_URL'] = window.location.href;
  values['CURRENT_PAGE_TITLE'] = document.title;

  // Replace variables in template
  let result = template;
  for (const [varName, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{${varName}\\}`, 'g'), value);
  }

  // Parse and convert to HTML
  const html = parseToHtml(result);
  const plainText = stripTags(html);

  // Copy to clipboard with both HTML and plain text
  try {
    const htmlBlob = new Blob([html], { type: 'text/html' });
    const textBlob = new Blob([plainText], { type: 'text/plain' });

    navigator.clipboard.write([
      new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': textBlob
      })
    ]).then(() => {
      // Show visual feedback
      showCopyFeedback();
    }).catch(err => {
      // Fallback to plain text
      navigator.clipboard.writeText(plainText).then(() => {
        showCopyFeedback();
      });
    });
  } catch (err) {
    // Final fallback
    navigator.clipboard.writeText(plainText);
    showCopyFeedback();
  }

  // Visual feedback function
  function showCopyFeedback() {
    const feedback = document.createElement('div');
    feedback.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #059669;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 2147483647;
      animation: slideIn 0.3s ease;
    `;
    feedback.textContent = '✓ Copied to clipboard!';

    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(feedback);

    setTimeout(() => {
      feedback.style.opacity = '0';
      feedback.style.transform = 'translateX(100px)';
      feedback.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        feedback.remove();
        style.remove();
      }, 300);
    }, 2000);
  }

  return { html, plainText, values };
}


// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'REBUILD_MENU') {
    buildContextMenu();
    sendResponse({ success: true });
  }
  return true;
});

