# PromptFlow Chrome Extension

[![CI](https://github.com/axetroy/PromptFlow/actions/workflows/ci.yml/badge.svg)](https://github.com/axetroy/PromptFlow/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/axetroy/PromptFlow?include_prereleases&label=release)](https://github.com/axetroy/PromptFlow/releases)
[![License](https://img.shields.io/github/license/axetroy/PromptFlow)](LICENSE)

A browser-level Prompt Command System that provides quick prompt invocation in any input field.

## Features

- **Trigger**: Type `/prompts` in any input field to activate
- **Quick Insert**: Select a prompt and it replaces the trigger text
- **Search**: Filter prompts by title, content, or tags
- **Keyboard Navigation**: Use arrow keys, Enter, and Escape
- **Local Storage**: All prompts stored locally in Chrome
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Installation

### From Source

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `dist` folder

### From Release

Download the latest release from [Releases](https://github.com/axetroy/PromptFlow/releases) and unzip it.

## Build

```bash
# Install dependencies
npm install

# Build the extension
npm run build
```

This will compile TypeScript files and copy assets to the `dist/` folder.

## Development

```bash
# Install dependencies
npm install

# Type check
npm run typecheck

# Run tests
npm test

# Build for production
npm run build
```

## Usage

1. Navigate to any website with a text input
2. Click on an input field, textarea, or contenteditable element
3. Type `/prompts` to trigger the prompt panel
4. Use arrow keys to navigate or type to search
5. Press Enter to insert the selected prompt
6. Press Escape to close the panel

### Supported Input Types

- Standard `<input>` elements
- `<textarea>` elements
- Contenteditable elements (`<div contenteditable>`, `<p contenteditable>`)
- Works with ChatGPT, Claude, and other AI chat interfaces

## Project Structure

```
├── .github/
│   └── workflows/
│       └── ci.yml           # GitHub Actions CI/CD
├── src/
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Storage and utility functions
│   ├── content.ts           # Content script (input detection, panel)
│   ├── background.ts        # Service worker (data management)
│   └── panel.css            # Panel styles
├── scripts/
│   ├── build.js             # esbuild bundler script
│   └── copy-assets.js       # Asset copy script
├── tests/
│   └── content.test.ts      # Playwright integration tests
├── icons/                   # Extension icons
├── .npmrc                   # npm configuration (Playwright mirror)
├── playwright.config.ts     # Playwright configuration
├── tsconfig.json            # TypeScript configuration
└── package.json             # Project dependencies
```

## Architecture

- **Content Script**: Handles input detection, trigger recognition, and panel UI
- **Background Service Worker**: Manages prompt data and storage
- **Shadow DOM**: Panel uses shadow DOM for style isolation
- **esbuild**: Fast TypeScript bundling for production builds

## CI/CD

This project uses GitHub Actions for continuous integration:

- **Test**: Runs type checks, build, and Playwright tests
- **Release**: Creates zip archive on version tags

## License

MIT
