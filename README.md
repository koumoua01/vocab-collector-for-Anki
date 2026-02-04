# Vocab Collector for Anki

A Firefox-first browser extension that lets you capture words from any page and save them to Anki via AnkiConnect.

## Features
- Capture selection from any page
- Edit term, definition, example, source
- Auto-define with a dictionary API (default)
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

## Prerequisites
1. **Anki Desktop** installed and running.
2. **AnkiConnect** add-on installed (Code: `2055492159`).
   - *Note: You must restart Anki after installing the add-on.*
3. Ensure Anki is open in the background while using the extension.

## Usage
### Quick save with popover
1. Double-click a word or phrase on any page.
2. Review or edit the term/definition/example.
3. Click **Save** to send to Anki, or **Dismiss** to close.

### History & Quick Access
1. Click the extension icon in the toolbar.
2. View your recently saved words in the History tab.
3. Click **Add New Vocab** button to manually trigger the popover on the current page.

## Settings
Open the Options page to configure:
- **AnkiConnect URL** (default: http://127.0.0.1:8765)
- **Default Deck** and **Model**
- **Default Tags** and duplicate policy
- **Field Mapping** for your Anki model
- **OpenRouter API key and model** (optional)

## Field Mapping
The extension supports the following fields and can auto-add them to your Anki model if enabled:

- `Word`
- `Phonetic`
- `Origin`
- `PartOfSpeech`
- `Definitions`
- `Synonyms`
- `Antonyms`
- `SourceExample`
- `Source`

## OpenRouter AI definitions
AI definition generation uses OpenRouter. To enable:
1. Set your OpenRouter API key in Options.
2. Choose a model, e.g. `deepseek/deepseek-v3.2`.
3. Click **Auto-define** in the popup or **Define** in the popover.

If OpenRouter returns a policy error, visit https://openrouter.ai/settings/privacy and enable the required data policy.

## Permissions
- `storage`: save settings, drafts, and history
- `activeTab` / `tabs`: read the active page selection
- `contextMenus`: right-click "Save vocab to Anki"
- Host access:
	- AnkiConnect (http://127.0.0.1:8765, http://localhost:8765)
	- Dictionary API (https://api.dictionaryapi.dev)
	- OpenRouter API (https://openrouter.ai)

## Definition lookup behavior
- **Default**: Dictionary lookup first.
- **AI fallback**: If the dictionary has no result and an OpenRouter key is set, it will try AI.
- **Non-English**: You can prefer AI for non-English terms in Options.

## Troubleshooting
- **No fields beyond Front/Back**: your Anki model only has those fields. Add fields in Anki, then map them in Options.
- **OpenRouter HTTP 404**: check model ID and your privacy settings.
- **AnkiConnect not found**: ensure Anki is open and AnkiConnect is installed.

## Requirements
- Anki desktop with AnkiConnect installed and running

## Browser Compatibility
This extension supports both Chrome and Firefox. The project includes separate manifest files for each browser:

- `manifest-chrome.json`: Optimized for Chrome/Chromium browsers
- `manifest-firefox.json`: Optimized for Firefox

**Important**: Before loading the extension, you must replace the content of `manifest.json` with the content from the appropriate browser-specific manifest file (`manifest-chrome.json` or `manifest-firefox.json`) depending on which browser you plan to use.

## Load in Firefox
1. Copy the content of `manifest-firefox.json` into `manifest.json`
2. Open about:debugging#/runtime/this-firefox
3. Click "Load Temporary Add-on" and select `manifest.json`

## Load in Chrome
1. Copy the content of `manifest-chrome.json` into `manifest.json`
2. Open chrome://extensions
3. Enable Developer mode
4. Click "Load unpacked" and select the project folder

## Contributing
Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

