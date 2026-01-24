const api = globalThis.browser ?? chrome;

export const DEFAULT_SETTINGS = {
  ankiConnectUrl: "http://127.0.0.1:8765",
  deckName: "Default",
  modelName: "Basic",
  fieldMapping: {
    front: "Front",
    back: "Back",
    example: "",
    source: "",
    key: "",
    word: "",
    context: "",
    frontContext: "",
    backDefOnly: "",
    reverse: ""
  },
  tags: "vocab",
  allowDuplicate: false,
  openRouterApiKey: "",
  openRouterModel: "openrouter/auto",
  openRouterEndpoint: "https://openrouter.ai/api/v1/chat/completions"
};

export async function getSettings() {
  const result = await api.storage.local.get(["settings"]);
  return { ...DEFAULT_SETTINGS, ...(result.settings || {}) };
}

export async function saveSettings(settings) {
  await api.storage.local.set({ settings });
}

export async function getDraft() {
  const result = await api.storage.local.get(["draft"]);
  return result.draft || null;
}

export async function saveDraft(draft) {
  await api.storage.local.set({ draft });
}

export async function clearDraft() {
  await api.storage.local.remove(["draft"]);
}

export async function addHistory(item, maxItems = 20) {
  const result = await api.storage.local.get(["history"]);
  const history = Array.isArray(result.history) ? result.history : [];
  history.unshift(item);
  const trimmed = history.slice(0, maxItems);
  await api.storage.local.set({ history: trimmed });
  return trimmed;
}

export async function getHistory() {
  const result = await api.storage.local.get(["history"]);
  return Array.isArray(result.history) ? result.history : [];
}
