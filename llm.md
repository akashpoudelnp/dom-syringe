# DOM Syringe - LLM Development Notes

## Project Overview

DOM Syringe is a Chrome extension that allows users to:
1. Select text elements from any webpage using a visual picker
2. Create reusable "copy items" with variables mapped to DOM selectors
3. Define templates combining variables with Markdown links
4. Access saved copy items via Chrome's context menu
5. Auto-copy formatted content (rich HTML or plain text) to clipboard

## Architecture (v0.2.0 - React + TypeScript)

```
dom-syringe/
├── manifest.json              # Chrome Extension Manifest V3
├── vite.config.ts             # Vite + CRXJS config
├── tsconfig.json              # TypeScript config
├── index.html                 # Popup entry HTML
├── public/
│   └── icons/                 # Extension icons
├── src/
│   ├── main.tsx               # React entry point
│   ├── App.tsx                # Main app component
│   ├── App.module.css
│   ├── components/            # Reusable UI components
│   │   ├── Button/
│   │   ├── Toast/
│   │   └── Header/
│   ├── pages/                 # View components
│   │   ├── ListView/
│   │   └── EditorView/
│   ├── hooks/
│   │   └── useStore.ts        # Zustand store
│   ├── lib/                   # Shared utilities
│   │   ├── types.ts           # TypeScript types
│   │   ├── constants.ts       # Shared constants
│   │   ├── storage.ts         # Chrome storage utilities
│   │   ├── template.ts        # Template parsing
│   │   ├── dom.ts             # DOM utilities
│   │   └── messaging.ts       # Chrome messaging
│   ├── styles/
│   │   └── globals.css        # Global CSS variables
│   ├── background/
│   │   └── index.ts           # Service worker
│   └── content/
│       ├── index.tsx          # Content script
│       └── content.css        # Picker styles
└── _old/                      # Backup of v1.x files
```

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **CRXJS** - Chrome extension Vite plugin
- **Zustand** - State management
- **Tabler Icons** - Icon font (webfont)
- **CSS Modules** - Scoped styling

## Template Syntax

```
{varName}           → Variable interpolation
[text](url)         → Markdown link: <a href="url">text</a>
```

## Built-in Variables

- `{CURRENT_PAGE_URL}` - Current page URL
- `{CURRENT_PAGE_TITLE}` - Current page title

## Key Features

### Picker Flow
1. User clicks "Add Variable" in popup
2. Content script activates picker overlay
3. User hovers over elements (highlighted)
4. Press `Cmd+Shift+E` to confirm selection
5. Press `Esc` to cancel
6. Selector saved, variable value fetched

### Context Menu Copy
1. User right-clicks on any page
2. Selects copy item from "DOM Syringe" menu
3. Background script injects `extractAndCopy` function
4. Variables extracted from DOM using saved selectors
5. Template parsed, copied to clipboard (HTML + plain text)
6. Toast notification shown

## Development

```bash
# Install dependencies
npm install

# Development with hot reload
npm run dev

# Build for production
npm run build

# Load in Chrome
# 1. Go to chrome://extensions
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select the `dist` folder
```

## Changelog

### v0.2.0 - December 2024 (React Rewrite)
- Complete rewrite using React + TypeScript
- Vite build with CRXJS for hot reload
- Zustand for state management
- CSS Modules for scoped styling
- Tabler Icons (webfont) instead of emojis
- Shared lib folder for utilities
- Cleaner component architecture
- Better type safety throughout

### v1.0.x - December 2024 (Vanilla JS)
- Initial MVP with vanilla JavaScript
- Basic picker, editor, context menu
- Markdown link support
- Toast notifications

