const api = globalThis.browser?.runtime?.sendMessage ? globalThis.browser : globalThis.chrome;

function getSelectionInfo() {
  const selection = window.getSelection();
  const text = selection ? selection.toString().trim() : "";

  let sentence = "";
  if (selection && selection.anchorNode) {
    const container = selection.anchorNode.parentElement || selection.anchorNode;
    const containerText = container && container.innerText ? container.innerText : "";
    if (containerText && text) {
      const parts = containerText.split(/(?<=[.!?])\s+/);
      const match = parts.find((part) => part.includes(text));
      if (match) {
        sentence = match.trim();
      }
    }
  }

  if (!sentence && text) {
    sentence = text;
  }

  return {
    text,
    sentence,
    title: document.title || "",
    url: location.href
  };
}

function callBackground(message) {
  return new Promise((resolve, reject) => {
    try {
      if (!api?.runtime?.sendMessage) {
        throw new Error("Extension context invalidated");
      }
      api.runtime.sendMessage(message, (response) => {
        if (api.runtime.lastError) {
          reject(new Error(api.runtime.lastError.message));
          return;
        }
        if (!response || response.ok === false) {
          reject(new Error(response?.error || "Unknown error"));
          return;
        }
        resolve(response.result);
      });
    } catch (error) {
      reject(error);
    }
  });
}

let popover = null;
let popoverBackdrop = null;

function removePopover() {
  if (popover) popover.remove();
  if (popoverBackdrop) popoverBackdrop.remove();
  popover = null;
  popoverBackdrop = null;
}

function createPopover(selection) {
  removePopover();

  popoverBackdrop = document.createElement("div");
  popoverBackdrop.style.cssText = [
    "position: fixed",
    "top: 0",
    "left: 0",
    "width: 100%",
    "height: 100%",
    "z-index: 2147483646",
    "background: rgba(15, 23, 42, 0.35)"
  ].join(";");
  popoverBackdrop.addEventListener("click", removePopover);

  popover = document.createElement("div");
  popover.style.cssText = [
    "position: fixed",
    "top: 24px",
    "right: 24px",
    "width: 340px",
    "max-width: calc(100vw - 48px)",
    "max-height: calc(100vh - 48px)",
    "overflow: hidden",
    "z-index: 2147483647",
    "background: #0f172a",
    "color: #e2e8f0",
    "border: 1px solid #1f2937",
    "border-radius: 14px",
    "box-shadow: 0 12px 30px rgba(15, 23, 42, 0.45)",
    "font-family: 'Segoe UI', system-ui, sans-serif",
    "padding: 14px",
    "display: grid",
    "gap: 10px"
  ].join(";");

  popover.innerHTML = `
    <style>
      .vc-root, .vc-root * {
        box-sizing: border-box;
        font-family: "Segoe UI", system-ui, sans-serif;
      }
      .vc-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .vc-title {
        font-weight: 600;
        font-size: 14px;
      }
      .vc-close {
        all: unset;
        cursor: pointer;
        color: #93c5fd;
        font-size: 14px;
        line-height: 1;
        padding: 2px;
        border-radius: 6px;
      }
      .vc-close:focus-visible {
        outline: 2px solid #93c5fd;
        outline-offset: 2px;
      }
      .vc-actions {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
        gap: 8px;
      }
      .vc-input,
      .vc-textarea,
      .vc-select {
        width: 100%;
        padding: 8px;
        border-radius: 8px;
        border: 1px solid #334155;
        background: #0b1220;
        color: #f8fafc;
        font-size: 12px;
        line-height: 1.4;
        font: inherit;
        box-shadow: none;
        outline: none;
        appearance: none;
        -moz-appearance: none;
      }
      .vc-input {
        min-height: 34px;
      }
      .vc-textarea {
        resize: vertical;
      }
      .vc-select {
        background-image: none;
      }
      @supports (-moz-appearance: none) {
        .vc-input,
        .vc-select {
          min-height: 30px;
          padding: 6px 8px;
        }
        .vc-textarea {
          padding: 6px 8px;
        }
      }
      .vc-button {
        all: unset;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 8px 10px;
        border-radius: 8px;
        font-size: 12px;
        line-height: 1;
        cursor: pointer;
        border: 1px solid transparent;
        text-align: center;
      }
      .vc-button:focus-visible {
        outline: 2px solid #93c5fd;
        outline-offset: 2px;
      }
      .vc-button--secondary {
        background: #1f2937;
        color: #e2e8f0;
        border-color: #334155;
      }
      .vc-button--primary {
        background: #2563eb;
        color: #fff;
      }
      .vc-button--ghost {
        background: transparent;
        color: #93c5fd;
        border-color: #334155;
      }
      /* Custom Scrollbar */
      .vc-root::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      .vc-root::-webkit-scrollbar-track {
        background: transparent;
      }
      .vc-root::-webkit-scrollbar-thumb {
        background: #334155;
        border-radius: 4px;
      }
      .vc-root::-webkit-scrollbar-thumb:hover {
        background: #475569;
      }
    </style>
    <div class="vc-root" style="max-height: calc(100vh - 80px); overflow: auto; padding-right: 4px;">
      <div class="vc-header">
        <div class="vc-title">Vocab Collector</div>
        <button id="vc-close" class="vc-close" type="button" aria-label="Close">✕</button>
      </div>
      <label style="display:grid;gap:6px;font-size:12px;">
        Word
        <input id="vc-word" class="vc-input" type="text" />
      </label>
      <label style="display:grid;gap:6px;font-size:12px;">
        Definition Source
        <select id="vc-definition-provider" class="vc-select">
          <option value="dictionaryapi">DictionaryAPI</option>
          <option value="wiktionary">Wiktionary</option>
          <option value="ai">AI</option>
        </select>
      </label>
      <label style="display:grid;gap:6px;font-size:12px;">
        Definitions
        <textarea id="vc-definitions" class="vc-textarea" rows="4"></textarea>
      </label>
      <details style="margin-top:8px;">
        <summary style="cursor:pointer;font-size:12px;color:#93c5fd;">More fields</summary>
        <div style="display:grid;gap:10px;margin-top:10px;">
          <label style="display:grid;gap:6px;font-size:12px;">
            Dictionary Example
            <textarea id="vc-dict-example" class="vc-textarea" rows="2"></textarea>
          </label>
          <label style="display:grid;gap:6px;font-size:12px;">
            Other Forms
            <textarea id="vc-other-forms" class="vc-textarea" rows="1"></textarea>
          </label>
          <label style="display:grid;gap:6px;font-size:12px;">
            Part of Speech
            <input id="vc-part-of-speech" class="vc-input" type="text" />
          </label>
          <label style="display:grid;gap:6px;font-size:12px;">
            Synonyms
            <textarea id="vc-synonyms" class="vc-textarea" rows="1"></textarea>
          </label>
          <label style="display:grid;gap:6px;font-size:12px;">
            Antonyms
            <textarea id="vc-antonyms" class="vc-textarea" rows="1"></textarea>
          </label>
          <label style="display:grid;gap:6px;font-size:12px;">
            Phonetic
            <input id="vc-phonetic" class="vc-input" type="text" />
          </label>
          <label style="display:grid;gap:6px;font-size:12px;">
            Origin
            <input id="vc-origin" class="vc-input" type="text" />
          </label>
          <label style="display:grid;gap:6px;font-size:12px;">
            Source Example
            <textarea id="vc-source-example" class="vc-textarea" rows="2"></textarea>
          </label>
        </div>
      </details>
      <div style="font-size:11px;color:#94a3b8;word-break:break-all;">
        Source: <a id="vc-source" href="#" target="_blank" style="color:#93c5fd;text-decoration:none;"></a>
      </div>
      <div id="vc-status" style="font-size:11px;color:#cbd5f5;">Ready</div>
      <div class="vc-actions">
        <button id="vc-define" class="vc-button vc-button--secondary" type="button">Define</button>
        <button id="vc-save" class="vc-button vc-button--primary" type="button">Save</button>
        <button id="vc-dismiss" class="vc-button vc-button--ghost" type="button">Dismiss</button>
      </div>
    </div>
  `;

  document.body.appendChild(popoverBackdrop);
  document.body.appendChild(popover);

  const wordInput = popover.querySelector("#vc-word");
  const definitionsInput = popover.querySelector("#vc-definitions");
  const dictExampleInput = popover.querySelector("#vc-dict-example");
  const definitionProviderSelect = popover.querySelector("#vc-definition-provider");
  const otherFormsInput = popover.querySelector("#vc-other-forms");
  const partOfSpeechInput = popover.querySelector("#vc-part-of-speech");
  const synonymsInput = popover.querySelector("#vc-synonyms");
  const antonymsInput = popover.querySelector("#vc-antonyms");
  const phoneticInput = popover.querySelector("#vc-phonetic");
  const originInput = popover.querySelector("#vc-origin");
  const sourceExampleInput = popover.querySelector("#vc-source-example");
  const sourceLink = popover.querySelector("#vc-source");
  const statusEl = popover.querySelector("#vc-status");
  let autoPartOfSpeech = "";
  let autoSynonyms = "";
  let autoAntonyms = "";
  let autoPhonetic = "";
  let autoOrigin = "";
  let autoDictExample = "";
  let autoOtherForms = "";

  wordInput.value = selection.text || "";
  sourceExampleInput.value = selection.sentence || "";
  sourceLink.textContent = selection.url || "";
  sourceLink.href = selection.url || "#";

  if (api?.storage?.local?.get) {
    api.storage.local.get(["settings"], (result) => {
      const providerValue = result?.settings?.definitionProvider || "dictionaryapi";
      definitionProviderSelect.value =
        providerValue === "dictionary" ? "dictionaryapi" : providerValue;
    });
  }

  popover.querySelector("#vc-close").addEventListener("click", removePopover);
  popover.querySelector("#vc-dismiss").addEventListener("click", removePopover);

  popover.querySelector("#vc-define").addEventListener("click", async () => {
    const word = wordInput.value.trim();
    if (!word) {
      statusEl.textContent = "Enter a word first.";
      return;
    }
    const provider = definitionProviderSelect.value || "dictionaryapi";
    statusEl.textContent = "Generating definition...";
    try {
      const result = await callBackground({ type: "AUTO_DEFINE", term: word, provider });
      if (typeof result === "string") {
        definitionsInput.value = result;
        autoPartOfSpeech = "";
        autoSynonyms = "";
        autoAntonyms = "";
        autoPhonetic = "";
        autoOrigin = "";
        autoDictExample = "";
        autoOtherForms = "";
        partOfSpeechInput.value = "";
        synonymsInput.value = "";
        antonymsInput.value = "";
        phoneticInput.value = "";
        originInput.value = "";
        dictExampleInput.value = "";
        otherFormsInput.value = "";
      } else {
        definitionsInput.value = result.definitions || result.definition || "";
        autoPartOfSpeech = result.partOfSpeech || result.pos || "";
        autoSynonyms = result.synonyms || "";
        autoAntonyms = result.antonyms || "";
        autoPhonetic = result.phonetic || "";
        autoOrigin = result.origin || "";
        autoDictExample = result.dictExample || result.example || "";
        autoOtherForms = result.otherForms || result.otherForm || "";
        partOfSpeechInput.value = autoPartOfSpeech;
        synonymsInput.value = autoSynonyms;
        antonymsInput.value = autoAntonyms;
        phoneticInput.value = autoPhonetic;
        originInput.value = autoOrigin;
        otherFormsInput.value = autoOtherForms;
        if (autoDictExample && !dictExampleInput.value) {
          dictExampleInput.value = autoDictExample;
        }
        if ((result.sourceExample || result.example) && !sourceExampleInput.value) {
          sourceExampleInput.value = result.sourceExample || result.example;
        }
      }
      statusEl.textContent = "Definition ready.";
    } catch (error) {
      statusEl.textContent = `Error: ${error.message}`;
    }
  });

  popover.querySelector("#vc-save").addEventListener("click", async () => {
    const payload = {
      word: wordInput.value.trim(),
      phonetic: phoneticInput.value.trim() || autoPhonetic,
      origin: originInput.value.trim() || autoOrigin,
      otherForms: otherFormsInput.value.trim() || autoOtherForms,
      partOfSpeech: partOfSpeechInput.value.trim() || autoPartOfSpeech,
      definitions: definitionsInput.value.trim(),
      dictExample: dictExampleInput.value.trim() || autoDictExample,
      synonyms: synonymsInput.value.trim() || autoSynonyms,
      antonyms: antonymsInput.value.trim() || autoAntonyms,
      sourceExample: sourceExampleInput.value.trim(),
      source: selection.url || ""
    };

    if (!payload.word) {
      statusEl.textContent = "Word is required.";
      return;
    }

    statusEl.textContent = "Saving to Anki...";
    try {
      await callBackground({ type: "ADD_NOTE", payload });
      statusEl.textContent = "Saved to Anki.";
    } catch (error) {
      if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
        statusEl.textContent = "Error: Cannot connect to Anki. Is it open?";
      } else {
        statusEl.textContent = `Error: ${error.message}`;
      }
    }
  });

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") removePopover();
    },
    { once: true }
  );
}

document.addEventListener("dblclick", async () => {
  try {
    const settings = await callBackground({ type: "GET_SETTINGS" });
    if (settings.enableDoubleClick === false) return; // Only return if explicitly false

    const selection = getSelectionInfo();
    if (!selection.text) return;
    createPopover(selection);
  } catch (error) {
    // If extension context invalidates (e.g. update/reload), we probably want to stay silent or log
    if (error.message.includes("Extension context invalidated")) {
      console.log("Vocab collector: context invalidated, please reload page.");
    }
  }
});

if (api?.runtime?.onMessage?.addListener) {
  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return;

    if (message.type === "GET_SELECTION") {
      sendResponse(getSelectionInfo());
      return;
    }

    if (message.type === "SHOW_POPOVER") {
      const selection = getSelectionInfo();
      // Use the draft if provided, otherwise default selection info
      if (message.draft) {
         // Ideally we would merge draft info here, but for now let's just use what createPopover expects.
         // Only text is guaranteed.
         createPopover({ ...selection, ...message.draft });
      } else {
         createPopover(selection);
      }
      sendResponse({ ok: true });
      return;
    }
  });
}
