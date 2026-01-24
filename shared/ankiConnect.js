const api = globalThis.browser ?? chrome;

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
