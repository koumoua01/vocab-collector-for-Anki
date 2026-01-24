# Vocab Collector for Anki

A Firefox-first browser extension that lets you capture words from any page and save them to Anki via AnkiConnect.

## Features
- Capture selection from any page
- Edit term, definition, example, source
- Auto-define with a dictionary API
- Double-click popover with quick save or dismiss
- AI definitions with OpenRouter (optional)
- Configure deck, model, and field mapping
- Supports advanced fields (Key, Word, Context, FrontContext, BackDefOnly, Reverse)
- Save draft and maintain history

## How it works
- **Selection capture**: Highlights on a page are read by a content script.
- **Quick popover**: Double-click any selection to open a popover with Save/Dismiss.
- **Popup workflow**: Open the toolbar popup to edit details and send to Anki.
- **Background bridge**: All AnkiConnect and OpenRouter requests go through the background script.
- **Local storage**: Settings, draft, and history are stored locally in the browser.

## Usage
### Quick save with popover
1. Double-click a word or phrase on any page.
2. Review or edit the term/definition/example.
3. Click **Save** to send to Anki, or **Dismiss** to close.

### Full edit via popup
1. Click the extension icon.
2. Click **Use selection** to load current page selection.
3. Fill in fields and click **Send to Anki**.

## Settings
Open the Options page to configure:
- **AnkiConnect URL** (default: http://127.0.0.1:8765)
- **Default Deck** and **Model**
- **Default Tags** and duplicate policy
- **Field Mapping** for your Anki model
- **OpenRouter API key and model** (optional)

## Field Mapping
The extension can populate standard and advanced fields if your Anki model includes them.

**Standard fields**
- `Front`: term
- `Back`: definition
- `Example`: example sentence (optional)
- `Source`: source URL (optional)

**Advanced fields** (map only if present in your note type)
- `Key`: unique key (manual)
- `Word`: term
- `Context`: example sentence
- `FrontContext`: term + example
- `BackDefOnly`: definition only
- `Reverse`: custom flag (manual)

If a mapped field does not exist in your Anki model, it will be ignored by Anki.

## OpenRouter AI definitions
AI definition generation uses OpenRouter. To enable:
1. Set your OpenRouter API key in Options.
2. Choose a model, e.g. `deepseek/deepseek-v3.2`.
3. Click **AI Define** in the popup or popover.

If OpenRouter returns a policy error, visit https://openrouter.ai/settings/privacy and enable the required data policy.

## Permissions
- `storage`: save settings, drafts, and history
- `activeTab` / `tabs`: read the active page selection
- `contextMenus`: right-click "Save vocab to Anki"
- Host access:
	- AnkiConnect (http://127.0.0.1:8765, http://localhost:8765)
	- Dictionary API (https://api.dictionaryapi.dev)
	- OpenRouter API (https://openrouter.ai)

## Troubleshooting
- **No fields beyond Front/Back**: your Anki model only has those fields. Add fields in Anki, then map them in Options.
- **OpenRouter HTTP 404**: check model ID and your privacy settings.
- **AnkiConnect not found**: ensure Anki is open and AnkiConnect is installed.

## Requirements
- Anki desktop with AnkiConnect installed and running

## Load in Firefox
1. Open about:debugging#/runtime/this-firefox
2. Click "Load Temporary Add-on" and select manifest.json

## Load in Chrome
1. Open chrome://extensions
2. Enable Developer mode
3. Click "Load unpacked" and select the project folder
