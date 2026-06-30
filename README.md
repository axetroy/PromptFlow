# PromptFlow

[![CI](https://github.com/axetroy/PromptFlow/actions/workflows/ci.yml/badge.svg)](https://github.com/axetroy/PromptFlow/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/axetroy/PromptFlow?include_prereleases&label=release)](https://github.com/axetroy/PromptFlow/releases)
[![License](https://img.shields.io/github/license/axetroy/PromptFlow)](LICENCE)

A browser-level Prompt Command System — invoke any prompt instantly in any input field.

<p align="center">
  <img width="800" src="screenshot/screenshot.gif" alt="PromptFlow demo">
</p>

---

## Features

- ⚡ **Quick Invocation** — Type `/prompts` in any `input`, `textarea`, or `contenteditable` element to open the panel
- ⌨️ **Keyboard Navigation** — `↑` `↓` to navigate, `Enter` to insert, `Esc` to close
- 🔍 **Smart Search** — Real-time filtering across title, content, and tags
- 🌐 **Multi-language** — Auto-detects browser language; AI responds in your preferred language
- 🎨 **Themes** — Light & dark, follows system preference automatically
- 💾 **Data Management** — Import/Export, GitHub Sync, CRUD, built-in default prompts
- 🔒 **Privacy** — All data stored locally; no external calls except GitHub sync; Shadow DOM isolation

## Default Prompts

| Prompt           | Description                                            |
| ---------------- | ------------------------------------------------------ |
| Code Review      | Review code and provide improvement suggestions        |
| Explain Code     | Get detailed explanation of any code                   |
| Bug Fix          | Debug and fix code issues                              |
| Write Tests      | Generate test cases for code                           |
| Refactor Code    | Improve code structure and quality                     |
| Analyze Error    | Analyze and understand error messages                  |
| Prompt Optimizer | Optimize and enhance prompts for large language models |

## Installation

### From Source

```bash
git clone https://github.com/axetroy/PromptFlow.git
cd PromptFlow
npm install
npm run build
```

Then open `chrome://extensions/`, enable **Developer mode**, and click **Load unpacked** — select the `dist/` folder.

### From Release

Download the latest release from the [Releases page](https://github.com/axetroy/PromptFlow/releases) and unzip.

## Usage

1. Click any text input on any webpage
2. Type `/prompts` to open the prompt panel
3. Navigate with `↑` `↓` or type to search
4. Press `Enter` to insert the prompt at cursor position
5. Press `Esc` to close the panel

### Settings

Click the extension icon in the toolbar, or the settings button in the panel, to:

- Customize the trigger command
- Add / Edit / Delete prompts
- Import / Export prompts
- Sync prompts from GitHub
- Reset to defaults

### GitHub Sync

Sync prompts from a GitHub repository:

1. Open settings → **Sync from GitHub**
2. Enter repository in `owner/repo` format
3. Optionally specify branch and prompts path
4. Prompts are synced automatically

Repository requirements: prompt files must be `.md` with YAML frontmatter including a `title` field.

## Development

```bash
npm install
npm run dev          # build once
npm run typecheck    # TypeScript type checking
npm test             # Playwright integration tests
npm run build        # production build
```

## Project Structure

```
src/
├── types/            # Type definitions (prompt, sync)
├── utils/            # Storage & utility functions
├── prompts/          # Default prompt templates (.md)
├── SettingsApp.tsx   # Settings page (React)
├── SyncManager.tsx   # GitHub sync manager
├── content.ts        # Content script
├── background.ts     # Service worker
```

## Architecture

```
┌─────────────────────────────────┐
│      Content Script             │
│  Input monitoring & trigger     │
│  Cursor management & insertion  │
├─────────────────────────────────┤
│      UI Layer (Floating Panel)  │
│  Shadow DOM isolation           │
│  Search & keyboard navigation   │
├─────────────────────────────────┤
│  Background Service Worker      │
│  Data management & storage sync │
│  GitHub integration             │
└─────────────────────────────────┘
```

## CI/CD

GitHub Actions runs type checks, builds, and Playwright tests on every push. Releases are automatically packaged on version tags.

## License

[MIT](LICENCE)
