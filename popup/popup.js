import { addNote } from "../shared/ankiConnect.js";
import {
  getSettings,
  getDraft,
  saveDraft,
  clearDraft,
  addHistory,
  getHistory
} from "../shared/storage.js";

const api = globalThis.browser ?? chrome;

const statusEl = document.getElementById("status");
const selectionPreview = document.getElementById("selection-preview");
const useSelectionButton = document.getElementById("use-selection");
const openOptionsButton = document.getElementById("open-options");
const autoDefineButton = document.getElementById("auto-define");
const saveDraftButton = document.getElementById("save-draft");
const sendButton = document.getElementById("send-anki");
const clearHistoryButton = document.getElementById("clear-history");
const historyList = document.getElementById("history");
const form = document.getElementById("card-form");

const formFields = {
  term: document.getElementById("term"),
  definition: document.getElementById("definition"),
  example: document.getElementById("example"),
  source: document.getElementById("source"),
  tags: document.getElementById("tags"),
  deck: document.getElementById("deck"),
  model: document.getElementById("model"),
  key: document.getElementById("key"),
  word: document.getElementById("word"),
  context: document.getElementById("context"),
  frontContext: document.getElementById("front-context"),
  backDefOnly: document.getElementById("back-def-only"),
  reverse: document.getElementById("reverse")
};

let settings = null;
let currentSelection = null;

function setStatus(text, tone = "info") {
  statusEl.textContent = text;
  statusEl.dataset.tone = tone;
}

function populateForm(data) {
  if (!data) return;
  if (data.text && !formFields.term.value) formFields.term.value = data.text;
  if (data.sentence && !formFields.example.value) formFields.example.value = data.sentence;
  if (data.url && !formFields.source.value) formFields.source.value = data.url;
  if (data.tags && !formFields.tags.value) formFields.tags.value = data.tags;
  if (data.context && !formFields.context.value) formFields.context.value = data.context;
  if (data.frontContext && !formFields.frontContext.value) formFields.frontContext.value = data.frontContext;
}

function getFormData() {
  return {
    term: formFields.term.value.trim(),
    definition: formFields.definition.value.trim(),
    example: formFields.example.value.trim(),
    source: formFields.source.value.trim(),
    tags: formFields.tags.value.trim(),
    deck: formFields.deck.value.trim(),
    model: formFields.model.value.trim(),
    key: formFields.key.value.trim(),
    word: formFields.word.value.trim(),
    context: formFields.context.value.trim(),
    frontContext: formFields.frontContext.value.trim(),
    backDefOnly: formFields.backDefOnly.value.trim(),
    reverse: formFields.reverse.value.trim()
  };
}

function renderHistory(items) {
  historyList.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = "No items yet.";
    historyList.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    const title = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = item.term || "";
    title.appendChild(strong);

    const definition = document.createElement("div");
    definition.className = "meta";
    definition.textContent = item.definition || "";

    const source = document.createElement("div");
    source.className = "meta";
    source.textContent = item.source || "";

    li.appendChild(title);
    li.appendChild(definition);
    li.appendChild(source);
    historyList.appendChild(li);
  });
}

async function loadSelectionFromTab() {
  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return null;
    const response = await api.tabs.sendMessage(tab.id, { type: "GET_SELECTION" });
    return response;
  } catch (error) {
    return null;
  }
}

async function initialize() {
  settings = await getSettings();
  formFields.deck.value = settings.deckName;
  formFields.model.value = settings.modelName;
  formFields.tags.value = settings.tags || "";

  const draft = await getDraft();
  if (draft) {
    selectionPreview.textContent = draft.text || "Draft ready";
    populateForm(draft);
  }

  currentSelection = await loadSelectionFromTab();
  if (currentSelection && currentSelection.text) {
    selectionPreview.textContent = currentSelection.text;
    if (!draft) populateForm(currentSelection);
  }

  const history = await getHistory();
  renderHistory(history);

  api.runtime.sendMessage({ type: "CLEAR_BADGE" });
}

function callBackground(message) {
  return new Promise((resolve, reject) => {
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
  });
}

useSelectionButton.addEventListener("click", () => {
  if (!currentSelection) return;
  populateForm(currentSelection);
  setStatus("Selection loaded.");
});

openOptionsButton.addEventListener("click", () => {
  if (api.runtime.openOptionsPage) {
    api.runtime.openOptionsPage();
  } else {
    window.open(api.runtime.getURL("options/options.html"));
  }
});

autoDefineButton.addEventListener("click", async () => {
  const term = formFields.term.value.trim();
  if (!term) {
    setStatus("Enter a term first.", "warn");
    return;
  }
  setStatus("Looking up definition...");
  try {
    if (settings?.openRouterApiKey) {
      const result = await callBackground({ type: "AI_DEFINE", term });
      if (typeof result === "string") {
        formFields.definition.value = result;
      } else {
        formFields.definition.value = result.definition || "";
        if (result.example && !formFields.example.value) {
          formFields.example.value = result.example;
        }
        if (result.example && !formFields.context.value) {
          formFields.context.value = result.example;
        }
        if (result.example && !formFields.frontContext.value) {
          formFields.frontContext.value = `${term}\n${result.example}`.trim();
        }
      }
      setStatus("AI definition loaded.");
      return;
    }

    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`);
    const data = await response.json();
    const first = data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition;
    if (first) {
      formFields.definition.value = first;
      setStatus("Definition loaded.");
    } else {
      setStatus("No definition found.", "warn");
    }
  } catch (error) {
    setStatus(`Auto-define failed: ${error.message}`, "error");
  }
});

saveDraftButton.addEventListener("click", async () => {
  const draft = getFormData();
  await saveDraft(draft);
  setStatus("Draft saved.");
});

clearHistoryButton.addEventListener("click", async () => {
  await api.storage.local.set({ history: [] });
  renderHistory([]);
  setStatus("History cleared.");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = getFormData();
  if (!data.term) {
    setStatus("Term is required.", "warn");
    return;
  }

  const fields = {
    [settings.fieldMapping.front || "Front"]: data.term,
    [settings.fieldMapping.back || "Back"]: data.definition || "",
    ...(settings.fieldMapping.example ? { [settings.fieldMapping.example]: data.example } : {}),
    ...(settings.fieldMapping.source ? { [settings.fieldMapping.source]: data.source } : {})
  };

  if (!settings.fieldMapping.example && data.example) {
    fields[settings.fieldMapping.back || "Back"] = `${fields[settings.fieldMapping.back || "Back"]}\n\nExample: ${data.example}`.trim();
  }
  if (!settings.fieldMapping.source && data.source) {
    fields[settings.fieldMapping.back || "Back"] = `${fields[settings.fieldMapping.back || "Back"]}\n\nSource: ${data.source}`.trim();
  }

  if (settings.fieldMapping.key) {
    fields[settings.fieldMapping.key] = data.key || "";
  }
  if (settings.fieldMapping.word) {
    fields[settings.fieldMapping.word] = data.word || data.term;
  }
  if (settings.fieldMapping.context) {
    fields[settings.fieldMapping.context] = data.context || data.example;
  }
  if (settings.fieldMapping.frontContext) {
    fields[settings.fieldMapping.frontContext] = data.frontContext || `${data.term}\n${data.example}`.trim();
  }
  if (settings.fieldMapping.backDefOnly) {
    fields[settings.fieldMapping.backDefOnly] = data.backDefOnly || data.definition || "";
  }
  if (settings.fieldMapping.reverse) {
    fields[settings.fieldMapping.reverse] = data.reverse || "";
  }

  try {
    setStatus("Sending to Anki...");
    await addNote({
      ankiConnectUrl: settings.ankiConnectUrl,
      deckName: data.deck || settings.deckName,
      modelName: data.model || settings.modelName,
      fields,
      tags: data.tags || settings.tags,
      allowDuplicate: settings.allowDuplicate
    });

    await addHistory({
      term: data.term,
      definition: data.definition,
      source: data.source,
      createdAt: new Date().toISOString()
    });

    await clearDraft();
    form.reset();
    formFields.deck.value = settings.deckName;
    formFields.model.value = settings.modelName;
    formFields.tags.value = settings.tags || "";
    setStatus("Saved to Anki.");
    renderHistory(await getHistory());
  } catch (error) {
    setStatus(`Error: ${error.message}`, "error");
  }
});

initialize();
