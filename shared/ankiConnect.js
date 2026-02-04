const api = globalThis.browser?.runtime?.sendMessage ? globalThis.browser : globalThis.chrome;

export async function ankiInvoke(action, params, url) {
  const response = await fetch(url, {
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

export async function addNote({
  ankiConnectUrl,
  deckName,
  modelName,
  fields,
  tags,
  allowDuplicate
}) {
  const note = {
    deckName,
    modelName,
    fields,
    tags: tags ? tags.split(/\s+/).filter(Boolean) : [],
    options: {
      allowDuplicate: Boolean(allowDuplicate)
    }
  };

  return ankiInvoke("addNote", { note }, ankiConnectUrl);
}

export async function requestPermission(ankiConnectUrl) {
  return ankiInvoke("requestPermission", {}, ankiConnectUrl);
}

export async function modelFieldNames(modelName, ankiConnectUrl) {
  return ankiInvoke("modelFieldNames", { modelName }, ankiConnectUrl);
}

export async function modelFieldAdd(modelName, fieldName, ankiConnectUrl) {
  return ankiInvoke("modelFieldAdd", { modelName, fieldName }, ankiConnectUrl);
}

export async function ensureModelFields(modelName, fieldNames, ankiConnectUrl) {
  if (!modelName || !Array.isArray(fieldNames) || !fieldNames.length) return;
  const existing = await modelFieldNames(modelName, ankiConnectUrl);
  const existingSet = new Set((existing || []).map((name) => String(name)));
  const missing = fieldNames.filter((name) => name && !existingSet.has(name));
  for (const fieldName of missing) {
    await modelFieldAdd(modelName, fieldName, ankiConnectUrl);
  }
}
