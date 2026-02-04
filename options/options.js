import { getSettings, saveSettings } from "../shared/storage.js";
import { requestPermission } from "../shared/ankiConnect.js";

const statusEl = document.getElementById("status");
const saveButton = document.getElementById("save");
const testButton = document.getElementById("test");
const testOpenRouterButton = document.getElementById("test-openrouter");
const api = globalThis.browser?.runtime?.sendMessage ? globalThis.browser : globalThis.chrome;

const fields = {
  ankiUrl: document.getElementById("anki-url"),
  deck: document.getElementById("deck"),
  model: document.getElementById("model"),
  tags: document.getElementById("tags"),
  allowDuplicate: document.getElementById("allow-duplicate"),
  autoAddFields: document.getElementById("auto-add-fields"),
  enableDoubleClick: document.getElementById("enable-double-click"),
  openRouterKey: document.getElementById("openrouter-key"),
  openRouterModel: document.getElementById("openrouter-model"),
  definitionProvider: document.getElementById("definition-provider"),
  aiFallback: document.getElementById("ai-fallback"),
  aiNonEnglish: document.getElementById("ai-non-english"),
  fieldWord: document.getElementById("field-word"),
  fieldPhonetic: document.getElementById("field-phonetic"),
  fieldOrigin: document.getElementById("field-origin"),
  fieldPartOfSpeech: document.getElementById("field-part-of-speech"),
  fieldDefinitions: document.getElementById("field-definitions"),
  fieldDictExample: document.getElementById("field-dict-example"),
  fieldSynonyms: document.getElementById("field-synonyms"),
  fieldAntonyms: document.getElementById("field-antonyms"),
  fieldSourceExample: document.getElementById("field-source-example"),
  fieldSourceUrl: document.getElementById("field-source")
};

function setStatus(text) {
  statusEl.textContent = text;
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

async function loadSettings() {
  const settings = await getSettings();
  fields.ankiUrl.value = settings.ankiConnectUrl;
  fields.deck.value = settings.deckName;
  fields.model.value = settings.modelName;
  fields.tags.value = settings.tags || "";
  fields.allowDuplicate.checked = Boolean(settings.allowDuplicate);
  fields.autoAddFields.checked = settings.autoAddFields !== false;
  // Migration logic: if triggerMode specific, convert. Else usage default.
  if (settings.triggerMode === "context-menu") {
      fields.enableDoubleClick.checked = false;
  } else {
      fields.enableDoubleClick.checked = settings.enableDoubleClick !== false;
  }
  fields.openRouterKey.value = settings.openRouterApiKey || "";
  fields.openRouterModel.value = settings.openRouterModel || "openrouter/auto";
  const providerValue = settings.definitionProvider || "dictionaryapi";
  fields.definitionProvider.value = providerValue === "dictionary" ? "dictionaryapi" : providerValue;
  fields.aiFallback.checked = settings.aiFallback !== false;
  fields.aiNonEnglish.checked = settings.aiNonEnglish !== false;
  fields.fieldWord.value = settings.fieldMapping.word || settings.fieldMapping.front || "Word";
  fields.fieldPhonetic.value = settings.fieldMapping.phonetic || "Phonetic";
  fields.fieldOrigin.value = settings.fieldMapping.origin || "Origin";
  fields.fieldPartOfSpeech.value = settings.fieldMapping.partOfSpeech || settings.fieldMapping.pos || "PartOfSpeech";
  fields.fieldDefinitions.value = settings.fieldMapping.definitions || settings.fieldMapping.back || "Definitions";
  fields.fieldDictExample.value = settings.fieldMapping.dictExample || "DictExample";
  fields.fieldSynonyms.value = settings.fieldMapping.synonyms || "Synonyms";
  fields.fieldAntonyms.value = settings.fieldMapping.antonyms || "Antonyms";
  fields.fieldSourceExample.value = settings.fieldMapping.sourceExample || settings.fieldMapping.example || "SourceExample";
  fields.fieldSourceUrl.value = settings.fieldMapping.source || "Source";
}

function collectSettings() {
  let modelValue = fields.openRouterModel.value.trim();
  if (modelValue) {
    try {
      const url = new URL(modelValue);
      if (url.hostname.includes("openrouter.ai")) {
        modelValue = url.pathname.replace(/^\//, "");
      }
    } catch (error) {
      // not a URL, ignore
    }
  }

  return {
    ankiConnectUrl: fields.ankiUrl.value.trim() || "http://127.0.0.1:8765",
    deckName: fields.deck.value.trim() || "Default",
    modelName: fields.model.value.trim() || "Basic",
    tags: fields.tags.value.trim(),
    allowDuplicate: fields.allowDuplicate.checked,
    autoAddFields: fields.autoAddFields.checked,
    enableDoubleClick: fields.enableDoubleClick.checked,
    definitionProvider: fields.definitionProvider.value || "dictionaryapi",
    aiFallback: fields.aiFallback.checked,
    aiNonEnglish: fields.aiNonEnglish.checked,
    openRouterApiKey: fields.openRouterKey.value.trim(),
    openRouterModel: modelValue || "openrouter/auto",
    fieldMapping: {
      word: fields.fieldWord.value.trim() || "Word",
      phonetic: fields.fieldPhonetic.value.trim() || "Phonetic",
      origin: fields.fieldOrigin.value.trim() || "Origin",
      partOfSpeech: fields.fieldPartOfSpeech.value.trim() || "PartOfSpeech",
      definitions: fields.fieldDefinitions.value.trim() || "Definitions",
      dictExample: fields.fieldDictExample.value.trim() || "DictExample",
      synonyms: fields.fieldSynonyms.value.trim() || "Synonyms",
      antonyms: fields.fieldAntonyms.value.trim() || "Antonyms",
      sourceExample: fields.fieldSourceExample.value.trim() || "SourceExample",
      source: fields.fieldSourceUrl.value.trim() || "Source"
    }
  };
}

saveButton.addEventListener("click", async () => {
  const settings = collectSettings();
  await saveSettings(settings);
  setStatus("Settings saved.");
});

testButton.addEventListener("click", async () => {
  const settings = collectSettings();
  try {
    setStatus("Testing connection...");
    await requestPermission(settings.ankiConnectUrl);
    setStatus("Connected to AnkiConnect.");
  } catch (error) {
    setStatus(`Connection failed: ${error.message}`);
  }
});

testOpenRouterButton.addEventListener("click", async () => {
  const settings = collectSettings();
  await saveSettings(settings);
  try {
    setStatus("Testing OpenRouter...");
    const result = await callBackground({ type: "AI_DEFINE", term: "test" });
    const definition = typeof result === "string" ? result : result.definitions || result.definition || "";
    setStatus(`OpenRouter OK: ${definition.slice(0, 80)}`);
  } catch (error) {
    setStatus(`OpenRouter failed: ${error.message}`);
  }
});

loadSettings();
