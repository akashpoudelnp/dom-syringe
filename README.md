<div align="center">
  <img src="https://github.com/akashpoudelnp/dom-syringe/blob/main/public/icons/icon128.png?raw=true" alt="DOM Syringe Logo" width="128" height="128">

# DOM Syringe

**Extract, template, and copy DOM content with a single click**

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)](https://chrome.google.com/webstore)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.3.0-blue.svg)](package.json)
</div>

---

## ✨ Features

- 🎯 **Visual Element Picker** - Point and click to select any text element on a webpage
- 📝 **Template System** - Create reusable templates with variables and Markdown links
- 📋 **One-Click Copy** - Access your copy items from the right-click context menu
- 🔗 **Rich Text Support** - Copies as both HTML (for rich editors) and plain text
- 💾 **Persistent Storage** - Your copy items sync across browser sessions

## 🚀 Quick Start

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/akashpoudelnp/dom-syringe.git
   cd dom-syringe
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load in Chrome:
    - Navigate to `chrome://extensions`
    - Enable **Developer mode** (top right)
    - Click **Load unpacked**
    - Select the `dist` folder

## 📖 How It Works

### 1. Create a Copy Item

Click the extension icon and create a new copy item with a name and template.

### 2. Add Variables

Use the visual picker to select elements from any webpage. Each variable maps to a CSS selector.

```
Template: Check out [{title}]({url}) by {author}
```

### 3. Copy with Context Menu

Right-click anywhere on a page and select your copy item from the **DOM Syringe** menu. The template is filled with live
DOM content and copied to your clipboard.

## 📝 Template Syntax

| Syntax        | Description            | Example                                                              |
|---------------|------------------------|----------------------------------------------------------------------|
| `{varName}`   | Variable interpolation | `{title}` → "My Article"                                             |
| `[text](url)` | Markdown link          | `[Click here](https://example.com)` → `<a href="...">Click here</a>` |

### Built-in Variables

| Variable               | Description        |
|------------------------|--------------------|
| `{CURRENT_PAGE_URL}`   | Current page URL   |
| `{CURRENT_PAGE_TITLE}` | Current page title |

## 🎮 Keyboard Shortcuts

| Shortcut               | Action                    |
|------------------------|---------------------------|
| `Cmd/Ctrl + Shift + E` | Confirm element selection |
| `Esc`                  | Cancel picker mode        |

## 🛠️ Development

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Lint code
npm run lint
```

## 🏗️ Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **CRXJS** - Chrome extension Vite plugin
- **Zustand** - State management
- **CSS Modules** - Scoped styling

## 📁 Project Structure

```
dom-syringe/
├── src/
│   ├── components/        # Reusable UI components
│   ├── pages/             # View components
│   ├── hooks/             # React hooks (Zustand store)
│   ├── lib/               # Utilities & types
│   ├── background/        # Service worker
│   └── content/           # Content script & picker
├── public/
│   └── icons/             # Extension icons
└── manifest.json          # Chrome Extension Manifest V3
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Tabler Icons](https://tabler-icons.io/) for the icon set
- [CRXJS](https://crxjs.dev/) for the amazing Vite plugin

---

<div align="center">
  Made with ❤️ by <a href="https://github.com/akashpoudelnp">Akash Poudel</a>
</div>
