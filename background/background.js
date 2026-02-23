const api = globalThis.browser?.runtime?.sendMessage ? globalThis.browser : globalThis.chrome;

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
  const defaults = {
    ankiConnectUrl: "http://127.0.0.1:8765",
    deckName: "Default",
    modelName: "Basic",
    enableDoubleClick: true,
    definitionProvider: "dictionaryapi"
  };
  return { ...defaults, ...(result.settings || {}) };
}

async function ankiInvoke(action, params, ankiConnectUrl) {
  const response = await fetch(ankiConnectUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, version: 6, params })
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

async function modelFieldNames(modelName, ankiConnectUrl) {
  return ankiInvoke("modelFieldNames", { modelName }, ankiConnectUrl);
}

async function modelFieldAdd(modelName, fieldName, ankiConnectUrl) {
  return ankiInvoke("modelFieldAdd", { modelName, fieldName }, ankiConnectUrl);
}

async function ensureModelFields(modelName, fieldNames, ankiConnectUrl) {
  if (!modelName || !Array.isArray(fieldNames) || !fieldNames.length) return;
  
  // 1. Check if model exists, if not create it
  const models = await ankiInvoke("modelNames", {}, ankiConnectUrl);
  if (!models.includes(modelName)) {
    // Create new model with these fields
    const frontField = fieldNames[0];
    const backFields = fieldNames.slice(1);
    
    // Simple default styling
    const css = `.card { font-family: arial; font-size: 20px; text-align: center; color: black; background-color: white; }
.field { margin-bottom: 10px; }
.field-name { font-size: 12px; color: #666; }`;

    const frontTemplate = `{{${frontField}}}`;
    let backTemplate = `{{FrontSide}}\n<hr id=answer>`;
    
    backFields.forEach(f => {
      backTemplate += `\n{{#${f}}}<div class="field"><div class="field-name">${f}</div><div>{{${f}}}</div></div>{{/${f}}}`;
    });

    await ankiInvoke("createModel", {
      modelName,
      inOrderFields: fieldNames,
      css,
      cardTemplates: [
        {
          Name: "Card 1",
          Front: frontTemplate,
          Back: backTemplate
        }
      ]
    }, ankiConnectUrl);
    return; // Created with all fields, no need to add fields
  }

  // 2. If model exists, ensure all fields exist
  const existing = await modelFieldNames(modelName, ankiConnectUrl);
  const existingSet = new Set((existing || []).map((name) => String(name)));
  const missing = fieldNames.filter((name) => name && !existingSet.has(name));
  for (const fieldName of missing) {
    await modelFieldAdd(modelName, fieldName, ankiConnectUrl);
  }
}

async function ensureDeck(deckName, ankiConnectUrl) {
  if (!deckName) return;
  const decks = await ankiInvoke("deckNames", {}, ankiConnectUrl);
  if (!decks.includes(deckName)) {
    await ankiInvoke("createDeck", { deck: deckName }, ankiConnectUrl);
  }
}

async function addToHistory(payload) {
  const item = {
    word: payload.word || payload.term || "",
    definitions: payload.definitions || payload.definition || "",
    source: payload.source || "",
    createdAt: new Date().toISOString()
  };
  const result = await api.storage.local.get(["history"]);
  const history = Array.isArray(result.history) ? result.history : [];
  history.unshift(item);
  const trimmed = history.slice(0, 50);
  await api.storage.local.set({ history: trimmed });
}

async function addNoteToAnki(payload) {
  const settings = await getSettings();
  const ankiConnectUrl = settings.ankiConnectUrl || "http://127.0.0.1:8765";
  const deckName = payload.deck || settings.deckName || "Default";
  const modelName = payload.model || settings.modelName || "Basic";
  const tags = payload.tags || settings.tags || "vocab";
  const fieldMapping = settings.fieldMapping || {
    word: "Word",
    phonetic: "Phonetic",
    origin: "Origin",
    otherForms: "OtherForms",
    partOfSpeech: "PartOfSpeech",
    definitions: "Definitions",
    dictExample: "DictExample",
    synonyms: "Synonyms",
    antonyms: "Antonyms",
    sourceExample: "SourceExample",
    source: "Source"
  };

  const wordField = fieldMapping.word || fieldMapping.front || "Word";
  const phoneticField = fieldMapping.phonetic || "Phonetic";
  const originField = fieldMapping.origin || "Origin";
  const otherFormsField = fieldMapping.otherForms || "OtherForms";
  const partOfSpeechField = fieldMapping.partOfSpeech || fieldMapping.pos || "PartOfSpeech";
  const definitionsField = fieldMapping.definitions || fieldMapping.back || "Definitions";
  const dictExampleField = fieldMapping.dictExample || "DictExample";
  const synonymsField = fieldMapping.synonyms || "Synonyms";
  const antonymsField = fieldMapping.antonyms || "Antonyms";
  const sourceExampleField = fieldMapping.sourceExample || fieldMapping.example || "SourceExample";
  const sourceField = fieldMapping.source || "Source";

  const fields = {
    [wordField]: payload.word || payload.term || "",
    [definitionsField]: payload.definitions || payload.definition || "",
    [dictExampleField]: payload.dictExample || payload.example || "",
    [partOfSpeechField]: payload.partOfSpeech || payload.pos || "",
    [synonymsField]: payload.synonyms || "",
    [antonymsField]: payload.antonyms || "",
    [phoneticField]: payload.phonetic || "",
    [originField]: payload.origin || "",
    [otherFormsField]: payload.otherForms || payload.otherForm || "",
    [sourceExampleField]: payload.sourceExample || payload.example || "",
    [sourceField]: payload.source || ""
  };

  await ensureDeck(deckName, ankiConnectUrl);

  if (settings.autoAddFields !== false) {
    await ensureModelFields(modelName, Object.keys(fields), ankiConnectUrl);
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

  await addToHistory(payload);
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
            "You are a dictionary assistant. Respond ONLY with a single JSON object. Keys: definitions, partOfSpeech, synonyms, antonyms, dictExample, phonetic, origin, otherForms. Use strings for all values. Format definitions as a single string with one line per sense, each line beginning with [part of speech], e.g. [noun] ... Keep values short. If unknown, return an empty string. otherForms should be a short comma-separated list of common inflections or variants if relevant."
        },
        {
          role: "user",
          content: `Return the JSON object for the word: ${term}`
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
  const extractJson = (value) => {
    if (!value) return null;
    const fencedMatch = value.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fencedMatch && fencedMatch[1]) {
      return fencedMatch[1].trim();
    }
    const firstBrace = value.indexOf("{");
    const lastBrace = value.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return value.slice(firstBrace, lastBrace + 1).trim();
    }
    const firstBracket = value.indexOf("[");
    const lastBracket = value.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      return value.slice(firstBracket, lastBracket + 1).trim();
    }
    return null;
  };
  let parsed = null;
  try {
    let jsonText = extractJson(text);
    if (jsonText) {
      // Fix common JSON issues like trailing commas
      jsonText = jsonText.replace(/,\s*([}\]])/g, '$1');
      parsed = JSON.parse(jsonText);
    }
  } catch (error) {
    parsed = null;
  }

  if (!parsed) {
    // Fallback: try to extract fields using regex if JSON parsing fails
    const extractField = (field) => {
      const strRegex = new RegExp(`"${field}"\\s*:\\s*"([^"\\\\]*(?:\\\\[\\s\\S][^"\\\\]*)*)"`, 'i');
      const strMatch = text.match(strRegex);
      if (strMatch && strMatch[1]) {
        try {
          return JSON.parse(`"${strMatch[1]}"`); // Handle escaped characters
        } catch (e) {
          return strMatch[1];
        }
      }
      const arrRegex = new RegExp(`"${field}"\\s*:\\s*\\[([^\\]]*)\\]`, 'i');
      const arrMatch = text.match(arrRegex);
      if (arrMatch && arrMatch[1]) {
        const items = arrMatch[1].match(/"([^"\\\\]*(?:\\\\[\\s\\S][^"\\\\]*)*)"/g);
        if (items) {
          return items.map(item => {
            try {
              return JSON.parse(item);
            } catch (e) {
              return item.replace(/^"|"$/g, '');
            }
          }).join(field === "definitions" || field === "definition" ? "\n" : ", ");
        }
      }
      return "";
    };
    const fallbackParsed = {
      definitions: extractField("definitions") || extractField("definition"),
      partOfSpeech: extractField("partOfSpeech") || extractField("pos"),
      synonyms: extractField("synonyms"),
      antonyms: extractField("antonyms"),
      dictExample: extractField("dictExample") || extractField("example") || extractField("sourceExample"),
      phonetic: extractField("phonetic"),
      origin: extractField("origin"),
      otherForms: extractField("otherForms") || extractField("inflections")
    };
    if (fallbackParsed.definitions || fallbackParsed.dictExample || fallbackParsed.partOfSpeech) {
      parsed = fallbackParsed;
    }
  }

  if (Array.isArray(parsed) && parsed.length > 0) {
    parsed = parsed[0];
  }
  if (parsed && parsed.result && typeof parsed.result === 'object') {
    parsed = parsed.result;
  }
  if (parsed && parsed.word && typeof parsed.word === 'object') {
    parsed = parsed.word;
  }

  if (parsed && (parsed.definition || parsed.definitions || parsed.example || parsed.sourceExample || parsed.dictExample)) {
    const normalizeValue = (value, isDefinition = false) => {
      if (Array.isArray(value)) return value.map(String).join(isDefinition ? "\n" : ", ");
      if (value === null || value === undefined) return "";
      return String(value);
    };
    return {
      definitions: normalizeValue(parsed.definitions ?? parsed.definition, true).trim(),
      partOfSpeech: normalizeValue(parsed.partOfSpeech ?? parsed.pos).trim(),
      synonyms: normalizeValue(parsed.synonyms).trim(),
      antonyms: normalizeValue(parsed.antonyms).trim(),
      dictExample: normalizeValue(parsed.dictExample ?? parsed.sourceExample ?? parsed.example).trim(),
      phonetic: normalizeValue(parsed.phonetic).trim(),
      origin: normalizeValue(parsed.origin).trim(),
      otherForms: normalizeValue(parsed.otherForms ?? parsed.otherForm ?? parsed.inflections).trim()
    };
  }
  return {
    definitions: text,
    partOfSpeech: "",
    synonyms: "",
    antonyms: "",
    dictExample: "",
    phonetic: "",
    origin: "",
    otherForms: ""
  };
}

function isLikelyNonEnglish(term) {
  if (!term) return false;
  return /[^A-Za-z\s'-]/.test(term);
}

function normalizeDictionaryResult(entry) {
  if (!entry) return null;
  const meanings = Array.isArray(entry.meanings) ? entry.meanings : [];
  const definitionLines = meanings.flatMap((meaning) => {
    const pos = meaning.partOfSpeech ? `[${meaning.partOfSpeech}] ` : "";
    const defs = Array.isArray(meaning.definitions) ? meaning.definitions : [];
    return defs.map((def) => (def?.definition ? `${pos}${def.definition}` : "")).filter(Boolean);
  });
  const examples = meanings
    .flatMap((meaning) => (Array.isArray(meaning.definitions) ? meaning.definitions : []))
    .map((def) => def?.example)
    .filter(Boolean);
  const partOfSpeech = meanings.map((meaning) => meaning.partOfSpeech).filter(Boolean).join(", ");
  const synonyms = meanings.flatMap((meaning) => meaning.synonyms || []).filter(Boolean);
  const antonyms = meanings.flatMap((meaning) => meaning.antonyms || []).filter(Boolean);
  const phonetic = entry.phonetic || entry.phonetics?.find((item) => item?.text)?.text || "";
  const origin = entry.origin || "";
  const dictExample = examples[0] || "";
  const result = {
    word: entry.word || "",
    phonetic,
    origin,
    partOfSpeech,
    definitions: definitionLines.join("\n") || "",
    synonyms: Array.from(new Set(synonyms)).join(", "),
    antonyms: Array.from(new Set(antonyms)).join(", "),
    dictExample
  };
  if (!result.definitions && !result.dictExample && !result.partOfSpeech && !result.synonyms) return null;
  return result;
}

async function dictionaryDefine(term) {
  const response = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`
  );
  if (!response.ok) {
    throw new Error(`Dictionary HTTP ${response.status}`);
  }
  const data = await response.json();
  const result = normalizeDictionaryResult(data?.[0]);
  if (!result) {
    throw new Error("No definition found");
  }
  return result;
}

function normalizeWiktionaryResult(languageBlock) {
  if (!languageBlock || !Array.isArray(languageBlock)) return null;
  const definitionLines = [];
  const synonyms = [];
  const antonyms = [];
  const examples = [];
  const parts = [];

  languageBlock.forEach((entry) => {
    const pos = entry?.partOfSpeech ? `[${entry.partOfSpeech}] ` : "";
    if (entry?.partOfSpeech) parts.push(entry.partOfSpeech);
    const defs = Array.isArray(entry?.definitions) ? entry.definitions : [];
    defs.forEach((def) => {
      if (def?.definition) {
        definitionLines.push(`${pos}${def.definition}`);
      }
      if (def?.example) examples.push(def.example);
      if (Array.isArray(def?.synonyms)) synonyms.push(...def.synonyms);
      if (Array.isArray(def?.antonyms)) antonyms.push(...def.antonyms);
    });
  });

  const result = {
    partOfSpeech: Array.from(new Set(parts)).join(", "),
    definitions: definitionLines.join("\n"),
    synonyms: Array.from(new Set(synonyms.filter(Boolean))).join(", "),
    antonyms: Array.from(new Set(antonyms.filter(Boolean))).join(", "),
    dictExample: examples[0] || "",
    phonetic: "",
    origin: ""
  };

  if (!result.definitions && !result.dictExample && !result.partOfSpeech && !result.synonyms) return null;
  return result;
}

async function wiktionaryDefine(term) {
  const response = await fetch(
    `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(term)}`
  );
  if (!response.ok) {
    throw new Error(`Wiktionary HTTP ${response.status}`);
  }
  const data = await response.json();
  const languageBlock = data?.en || data?.["en"] || data?.[Object.keys(data || {})[0]];
  const result = normalizeWiktionaryResult(languageBlock);
  if (!result) {
    throw new Error("No definition found");
  }
  return result;
}

async function defineWithProvider(provider, term) {
  if (provider === "ai") return aiDefine(term);
  if (provider === "wiktionary") return wiktionaryDefine(term);
  return dictionaryDefine(term);
}

async function autoDefine(term, providerOverride) {
  const settings = await getSettings();
  const rawProvider = providerOverride || settings.definitionProvider || "dictionaryapi";
  const provider = rawProvider === "dictionary" ? "dictionaryapi" : rawProvider;
  const aiAvailable = Boolean(settings.openRouterApiKey);
  const useAiForNonEnglish = settings.aiNonEnglish !== false;
  const allowAiFallback = settings.aiFallback !== false;
  const nonEnglish = useAiForNonEnglish && aiAvailable && isLikelyNonEnglish(term);

  if (provider === "ai") {
    try {
      return await aiDefine(term);
    } catch (error) {
      if (allowAiFallback) {
        return defineWithProvider("dictionaryapi", term);
      }
      throw error;
    }
  }

  if (nonEnglish) {
    try {
      return await aiDefine(term);
    } catch (error) {
      return defineWithProvider(provider, term);
    }
  }

  try {
    return await defineWithProvider(provider, term);
  } catch (error) {
    if (allowAiFallback && aiAvailable) {
      return aiDefine(term);
    }
    throw error;
  }
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

  if (tab?.id) {
    // Send message to show popover in the current tab
    try {
       await api.tabs.sendMessage(tab.id, { type: "SHOW_POPOVER" });
    } catch (error) {
       // ignore
    }
  }
});

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  if (message.type === "CLEAR_BADGE") {
    setBadge("").then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "GET_SETTINGS") {
    getSettings().then((result) => sendResponse({ ok: true, result }));
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

  if (message.type === "DICT_DEFINE") {
    dictionaryDefine(message.term)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "AUTO_DEFINE") {
    autoDefine(message.term, message.provider)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }


});
