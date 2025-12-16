# DOM Syringe - LLM Development Notes

## Project Overview

DOM Syringe is a Chrome extension that allows users to:
1. Select text elements from any webpage using a visual picker
2. Create reusable "copy items" with variables mapped to DOM selectors
3. Define rich templates combining variables with HTML formatting
4. Access saved copy items via Chrome's context menu
5. Auto-copy formatted content (rich HTML or plain text) to clipboard

## Architecture

```
dom-syringe/
├── manifest.json          # Chrome Extension Manifest V3
├── background/
│   └── background.js      # Service worker - context menu, clipboard
├── content/
│   ├── content.js         # DOM picker, element selection
│   └── content.css        # Picker UI styles
├── popup/
│   ├── popup.html         # Extension popup UI
│   ├── popup.css          # Popup styles
│   └── popup.js           # Popup logic, CRUD operations
└── icons/                 # Extension icons (16, 32, 48, 128px)
```

## Current Implementation (MVP - v1.0.1)

### What's Working
- [x] Manifest V3 configuration
- [x] Background service worker with context menu
- [x] Content script with element picker
- [x] Popup UI with list/editor views
- [x] Variable management (add, rename, delete)
- [x] Template editor with preview
- [x] Chrome Storage API for persistence
- [x] Dynamic context menu from saved items
- [x] Keyboard shortcut to confirm selection (`Cmd/Ctrl+Shift+E`)
- [x] Esc to cancel picker
- [x] Popup stays open during picker for seamless UX
- [x] Picker state recovery if popup accidentally closes

### Template Syntax
```
{varName}           → Variable interpolation
[text](url)         → Markdown link: <a href="url">text</a>
```

### Built-in Variables
- `{CURRENT_PAGE_URL}` - Current page URL
- `{CURRENT_PAGE_TITLE}` - Current page title

## Known Limitations

1. **Popup closes on picker activation** - This is Chrome's intentional behavior. WORKAROUND: State is now saved and recovered when popup reopens.
2. **No live variable preview in editor** - Variables show placeholders, not actual values until copy.
3. **CSS selector fragility** - Selectors may break if page structure changes.
4. **No import/export** - Copy items only in sync storage.
5. **Cannot use on chrome:// pages** - Chrome restricts content script injection on internal pages.

## Planned Improvements

### Phase 2 - Enhanced Picker
- [ ] Side panel instead of popup (persists during picking)
- [ ] Multi-element selection mode
- [ ] Visual selector refinement (parent/child navigation)
- [ ] Selector stability improvements (multiple strategies)

### Phase 3 - Rich Editor
- [ ] WYSIWYG editor instead of plain textarea
- [ ] Drag-and-drop variable insertion
- [ ] Formatting toolbar (bold, italic, headings, links)
- [ ] Template preview with live data from page

### Phase 4 - Advanced Features
- [ ] Copy item organization (folders/tags)
- [ ] Import/export functionality
- [ ] Keyboard shortcuts
- [ ] Template sharing
- [ ] Site-specific copy items

### Phase 5 - Polish
- [ ] Better icons with syringe design
- [ ] Animations and transitions
- [ ] Onboarding tour
- [ ] Dark mode support

## Technical Decisions

### Why Manifest V3?
- Required for new Chrome extensions
- Service workers instead of background pages
- Better security model

### Why CSS Selectors over XPath?
- Simpler, more familiar syntax
- Better browser support
- Easier to generate automatically
- Could add XPath as fallback later

### Why chrome.storage.sync over local?
- Syncs across devices
- Limited to 100KB total, 8KB per item
- Could add local storage option for large templates

## Development Notes

### Loading the Extension
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dom-syringe` folder

### Debugging
- Popup: Right-click extension icon → "Inspect popup"
- Background: Extensions page → "Service worker" link
- Content: Regular DevTools on any page

### Storage Schema
```javascript
{
  copyItems: [
    {
      name: "Blog Summary",
      template: "{title}[h1]\n{description}[p]",
      variables: {
        title: "#article-title",
        description: ".article-desc"
      }
    }
  ]
}
```

## Changelog

### v1.0.2 - December 2024
- Wider popup (480px) for better editing experience
- **Simplified template syntax** - Now uses standard Markdown links only: `[text](url)`
- **Live variable preview** - Shows actual values from page in both variable list and preview
- **Variable autocomplete** - Type `{` in editor to see suggestions, arrow keys to navigate, Enter/Tab to insert
- **Toast notification** - Shows "✓ Copied to clipboard!" when copying via context menu
- Better plain text fallback - Links show as "text (url)" format
- Improved editor with monospace font and proper styling

### v1.0.1 - December 2024
- Fixed duplicate context menu ID errors (proper async handling)
- Fixed `chrome.scripting` undefined error (added `scripting` permission + `host_permissions`)
- **Keyboard-based selection**: Hover over element and press `Cmd+Shift+E` (Mac) / `Ctrl+Shift+E` (Win) to confirm selection
- Press `Esc` to cancel picker
- Popup stays open during picking for seamless experience
- Click is blocked during picker mode to prevent accidental page navigation
- Picker state persisted for recovery if popup closes
- **Fixed variable text extraction** - Now properly extracts deep text from elements (textContent, value, alt, title)
- **Fixed context menu copy** - Made `extractAndCopy` self-contained with all helpers inline
- Live variable preview in popup now fetches actual values from page
- Better error messages for empty/missing content: `[No Element]`, `[No Content]`, `[Invalid Selector]`

### v1.0.0 (Initial MVP) - December 2024
- Basic element picker with highlight
- Copy item CRUD in popup
- Context menu integration
- Template syntax for formatting
- Clipboard with HTML/text fallback

