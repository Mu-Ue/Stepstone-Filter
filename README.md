# StepStone Company Filter

<div align="center">

![Chrome Web Store](https://img.shields.io/badge/Platform-Chrome%20Extension-blue)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![License: MIT](https://img.shields.io/badge/License-MIT-lightgrey)

A privacy-respecting Chrome extension that helps you control which job listings appear on StepStone.de. Filter out companies you're not interested in, and automatically close leftover tabs from the application flow.

</div>

---

## Features

- **Company Filtering** — Hide job listings from specific companies by adding their names to a filter list. Matching is case-insensitive and works as a substring match.
- **Auto-Close Tabs** — Automatically close lingering application confirmation tabs (detected via "Schon beworben" phrase) to keep your workspace clean.
- **Debug Mode** — Preview which listings would be hidden without actually hiding them, outlined in red.
- **Persistent Settings** — All filters and preferences sync across devices via Chrome's cloud storage.
- **Search & Filter UI** — Quickly search through your filter list and manage it with keyboard shortcuts.
- **Backup & Restore** — Export/import your entire configuration as a JSON file for easy transfer or backup.
- **Performance Optimized** — Uses MutationObserver with WeakSet tracking, CSS-based hiding, and visibility-aware pausing to minimize CPU and memory usage.

## Installation

### From Source (Development)

1. Download or clone this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select this project's root directory.

### Manual Side-Loading

1. Extract the downloaded source files.
2. Navigate to `chrome://extensions/` in Chrome.
3. Enable **Developer mode**.
4. Drag the entire project folder into the extensions page, or click **Load unpacked** and select it.

## Usage

1. Navigate to [StepStone.de](https://www.stepstone.de) and perform a job search.
2. Click the extension icon in Chrome's toolbar and select **Options**.
3. Add company names you want to filter (comma-separated values are supported).
4. Toggle optional settings:
   - **Debug mode** — outline instead of hide for preview
   - **Auto-close tabs** — automatically close lingering application confirmation tabs
5. Your filters take effect immediately on the current page and across all future visits.

### Keyboard Shortcuts (Options Page)

| Shortcut | Action |
|----------|--------|
| `Enter` / `Ctrl+Enter` | Add company to filter list |
| `Delete` | Remove selected company |
| `ArrowUp` / `ArrowDown` | Navigate selection in filter list |
| `Escape` | Clear search or blur focused input |

## Architecture

```
stepstone-filter/
├── src/
│   ├── manifest.json          # Extension manifest (Manifest V3)
│   ├── content/               # Content scripts running on stepstone.de
│   │   ├── constants.js       # Shared configuration constants
│   │   ├── dom-utils.js       # DOM traversal and selection helpers
│   │   ├── card-processor.js  # Job card scanning and filtering logic
│   │   └── index.js           # Entry point: observer setup, initialization
│   ├── background/            # Service worker (background script)
│   │   └── service-worker.js  # Opens options page & handles tab-close requests
│   ├── options/               # Options page files
│   │   ├── index.html         # UI layout
│   │   ├── style.css          # Component styles
│   │   └── app.js             # Business logic, rendering, I/O
│   └── types/                 # TypeScript-style type definitions (JSDoc)
│       └── index.d.ts
├── README.md                  # This file
├── LICENSE                    # MIT License
├── .gitignore
└── package.json