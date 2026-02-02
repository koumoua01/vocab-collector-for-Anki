const api = globalThis.browser ?? chrome;

async function setBadge(text) {
  const badgeApi = api.action || api.browserAction;
  if (!badgeApi || !badgeApi.setBadgeText) return;
  await badgeApi.setBadgeText({ text });
  if (badgeApi.setBadgeBackgroundColor) {
    await badgeApi.setBadgeBackgroundColor({ color: "#2563eb" });
  }
}

async function getSettings() {
  const result = await api.storage.local.get(["settings"]);
  return result.settings || {};
}

async function addNoteToAnki(payload) {
  const settings = await getSettings();
  const ankiConnectUrl = settings.ankiConnectUrl || "http://127.0.0.1:8765";
  const deckName = payload.deck || settings.deckName || "Default";
  const modelName = payload.model || settings.modelName || "Basic";
  const tags = payload.tags || settings.tags || "vocab";
  const fieldMapping = settings.fieldMapping || { front: "Front", back: "Back" };

  const fields = {
    [fieldMapping.front || "Front"]: payload.term || "",
    [fieldMapping.back || "Back"]: payload.definition || ""
  };

  if (fieldMapping.example) {
    fields[fieldMapping.example] = payload.example || "";
  } else if (payload.example) {
    fields[fieldMapping.back || "Back"] = `${fields[fieldMapping.back || "Back"]}\n\nExample: ${payload.example}`.trim();
  }
  if (fieldMapping.source) {
    fields[fieldMapping.source] = payload.source || "";
  } else if (payload.source) {
    fields[fieldMapping.back || "Back"] = `${fields[fieldMapping.back || "Back"]}\n\nSource: ${payload.source}`.trim();
  }

  if (fieldMapping.key) {
    fields[fieldMapping.key] = payload.key || "";
  }
  if (fieldMapping.pos) {
    fields[fieldMapping.pos] = payload.pos || "";
  } else if (payload.pos) {
    fields[fieldMapping.back || "Back"] = `${fields[fieldMapping.back || "Back"]}\n\nPOS: ${payload.pos}`.trim();
  }
  if (fieldMapping.synonyms) {
    fields[fieldMapping.synonyms] = payload.synonyms || "";
  } else if (payload.synonyms) {
    fields[fieldMapping.back || "Back"] = `${fields[fieldMapping.back || "Back"]}\n\nSynonyms: ${payload.synonyms}`.trim();
  }
  if (fieldMapping.word) {
    fields[fieldMapping.word] = payload.word || payload.term || "";
  }
  if (fieldMapping.context) {
    fields[fieldMapping.context] = payload.context || payload.example || "";
  }
  if (fieldMapping.frontContext) {
    const frontContextValue = payload.frontContext || payload.example || payload.term || "";
    fields[fieldMapping.frontContext] = frontContextValue;
  }
  if (fieldMapping.backDefOnly) {
    fields[fieldMapping.backDefOnly] = payload.backDefOnly || payload.definition || "";
  }
  if (fieldMapping.reverse) {
    fields[fieldMapping.reverse] = payload.reverse || "";
  }

  const response = await fetch(ankiConnectUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "addNote",
      version: 6,
      params: {
        note: {
          deckName,
          modelName,
          fields,
          tags: tags ? tags.split(/\s+/).filter(Boolean) : [],
          options: {
            allowDuplicate: Boolean(settings.allowDuplicate)
          }
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`AnkiConnect HTTP ${response.status}`);
  }
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }
  return data.result;
}

async function aiDefine(term) {
  const settings = await getSettings();
  if (!settings.openRouterApiKey) {
    throw new Error("OpenRouter API key missing");
  }
  const endpoint = settings.openRouterEndpoint || "https://openrouter.ai/api/v1/chat/completions";
  let model = settings.openRouterModel || "openrouter/auto";
  if (model.startsWith("http")) {
    try {
      const url = new URL(model);
      if (url.hostname.includes("openrouter.ai")) {
        model = url.pathname.replace(/^\//, "") || "openrouter/auto";
      }
    } catch (error) {
      // ignore invalid URL
    }
  }
  if (model.startsWith("openrouter.ai/")) {
    model = model.replace(/^openrouter\.ai\//, "");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.openRouterApiKey}`,
      "HTTP-Referer": "https://localhost",
      "X-Title": "Vocab Collector"
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a dictionary assistant. Provide a clear definition, the part of speech, a few synonyms, and one short example sentence. Respond in JSON with keys: definition, pos, synonyms, example. Keep everything concise."
        },
        {
          role: "user",
          content: `Define the term, provide part of speech, synonyms, and an example: ${term}`
        }
      ],
      max_tokens: 180,
      temperature: 0.4
    })
  });

  if (!response.ok) {
    let detail = "";
    try {
      detail = await response.text();
    } catch (error) {
      // ignore
    }
    throw new Error(`OpenRouter HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("No definition returned");
  }
  let parsed = null;
  try {
    let jsonText = text;
    const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fencedMatch && fencedMatch[1]) {
      jsonText = fencedMatch[1].trim();
    }
    parsed = JSON.parse(jsonText);
  } catch (error) {
    parsed = null;
  }
  if (parsed && (parsed.definition || parsed.example)) {
    const normalizeValue = (value) => {
      if (Array.isArray(value)) return value.map(String).join(", ");
      if (value === null || value === undefined) return "";
      return String(value);
    };
    return {
      definition: normalizeValue(parsed.definition).trim(),
      pos: normalizeValue(parsed.pos).trim(),
      synonyms: normalizeValue(parsed.synonyms).trim(),
      example: normalizeValue(parsed.example).trim()
    };
  }
  return {
    definition: text,
    pos: "",
    synonyms: "",
    example: ""
  };
}

api.runtime.onInstalled.addListener(() => {
  api.contextMenus.create({
    id: "add-to-anki",
    title: "Save vocab to Anki",
    contexts: ["selection"]
  });
});

api.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "add-to-anki") return;

  let selection = {
    text: info.selectionText || "",
    sentence: info.selectionText || "",
    title: tab?.title || "",
    url: tab?.url || ""
  };

  if (tab?.id) {
    try {
      const response = await api.tabs.sendMessage(tab.id, { type: "GET_SELECTION" });
      if (response && response.text) {
        selection = response;
      }
    } catch (error) {
      // ignore missing content script
    }
  }

  await api.storage.local.set({ draft: selection });
  await setBadge("1");
});

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  if (message.type === "CLEAR_BADGE") {
    setBadge("").then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "ADD_NOTE") {
    addNoteToAnki(message.payload)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "AI_DEFINE") {
    aiDefine(message.term)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});
