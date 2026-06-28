# PromptFlow Chrome Extension

A browser-level Prompt Command System that provides quick prompt invocation in any input field.

## Features

- **Trigger**: Type `/prompts` in any input field to activate
- **Quick Insert**: Select a prompt and it replaces the trigger text
- **Search**: Filter prompts by title, content, or tags
- **Keyboard Navigation**: Use arrow keys, Enter, and Escape
- **Local Storage**: All prompts stored locally in Chrome

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `dist` folder

## Build

```bash
npm install
npm run build
```

This will compile TypeScript files and copy assets to the `dist/` folder.

## Usage

1. Navigate to any website with a text input
2. Click on an input field or textarea
3. Type `/prompts` to trigger the prompt panel
4. Use arrow keys to navigate or type to search
5. Press Enter to insert the selected prompt
6. Press Escape to close the panel

## Project Structure

```
├── manifest.json       # Extension manifest (v3)
├── src/
│   ├── types/         # TypeScript type definitions
│   ├── utils/         # Storage and utility functions
│   ├── content.ts     # Content script (input detection, panel)
│   ├── background.ts  # Service worker (data management)
│   └── panel.css      # Panel styles
└── icons/             # Extension icons
```

## Architecture

- **Content Script**: Handles input detection, trigger recognition, and panel UI
- **Background Service Worker**: Manages prompt data and storage
- **Shadow DOM**: Panel uses shadow DOM for style isolation

## License

MIT
