import { getSettings, saveSettings } from "../shared/storage.js";
import { requestPermission } from "../shared/ankiConnect.js";

const statusEl = document.getElementById("status");
const saveButton = document.getElementById("save");
const testButton = document.getElementById("test");
const testOpenRouterButton = document.getElementById("test-openrouter");
const api = globalThis.browser ?? chrome;

const fields = {
  ankiUrl: document.getElementById("anki-url"),
  deck: document.getElementById("deck"),
  model: document.getElementById("model"),
  tags: document.getElementById("tags"),
  allowDuplicate: document.getElementById("allow-duplicate"),
  openRouterKey: document.getElementById("openrouter-key"),
  openRouterModel: document.getElementById("openrouter-model"),
  fieldFront: document.getElementById("field-front"),
  fieldBack: document.getElementById("field-back"),
  fieldPos: document.getElementById("field-pos"),
  fieldSynonyms: document.getElementById("field-synonyms"),
  fieldExample: document.getElementById("field-example"),
  fieldSource: document.getElementById("field-source"),
  fieldKey: document.getElementById("field-key"),
  fieldWord: document.getElementById("field-word"),
  fieldContext: document.getElementById("field-context"),
  fieldFrontContext: document.getElementById("field-front-context"),
  fieldBackDefOnly: document.getElementById("field-back-def-only"),
  fieldReverse: document.getElementById("field-reverse")
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
  fields.openRouterKey.value = settings.openRouterApiKey || "";
  fields.openRouterModel.value = settings.openRouterModel || "openrouter/auto";
  fields.fieldFront.value = settings.fieldMapping.front || "Front";
  fields.fieldBack.value = settings.fieldMapping.back || "Back";
  fields.fieldPos.value = settings.fieldMapping.pos || "";
  fields.fieldSynonyms.value = settings.fieldMapping.synonyms || "";
  fields.fieldExample.value = settings.fieldMapping.example || "";
  fields.fieldSource.value = settings.fieldMapping.source || "";
  fields.fieldKey.value = settings.fieldMapping.key || "";
  fields.fieldWord.value = settings.fieldMapping.word || "";
  fields.fieldContext.value = settings.fieldMapping.context || "";
  fields.fieldFrontContext.value = settings.fieldMapping.frontContext || "";
  fields.fieldBackDefOnly.value = settings.fieldMapping.backDefOnly || "";
  fields.fieldReverse.value = settings.fieldMapping.reverse || "";
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
    openRouterApiKey: fields.openRouterKey.value.trim(),
    openRouterModel: modelValue || "openrouter/auto",
    fieldMapping: {
      front: fields.fieldFront.value.trim() || "Front",
      back: fields.fieldBack.value.trim() || "Back",
      pos: fields.fieldPos.value.trim(),
      synonyms: fields.fieldSynonyms.value.trim(),
      example: fields.fieldExample.value.trim(),
      source: fields.fieldSource.value.trim(),
      key: fields.fieldKey.value.trim(),
      word: fields.fieldWord.value.trim(),
      context: fields.fieldContext.value.trim(),
      frontContext: fields.fieldFrontContext.value.trim(),
      backDefOnly: fields.fieldBackDefOnly.value.trim(),
      reverse: fields.fieldReverse.value.trim()
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
    const definition = typeof result === "string" ? result : result.definition || "";
    setStatus(`OpenRouter OK: ${definition.slice(0, 80)}`);
  } catch (error) {
    setStatus(`OpenRouter failed: ${error.message}`);
  }
});

loadSettings();
