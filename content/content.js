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
let popoverTemplatePromise = null;
const SOURCE_URL_MAX_LENGTH = 60;

function ensurePopoverStyles() {
  if (!api?.runtime?.getURL) return;
  const styleId = "vc-popover-styles";
  if (document.getElementById(styleId)) return;
  const link = document.createElement("link");
  link.id = styleId;
  link.rel = "stylesheet";
  link.href = api.runtime.getURL("content/popover.css");
  const target = document.head || document.documentElement;
  target.appendChild(link);
}

async function loadPopoverTemplate() {
  if (!popoverTemplatePromise) {
    const templateUrl = api?.runtime?.getURL
      ? api.runtime.getURL("content/popover.html")
      : "";
    popoverTemplatePromise = fetch(templateUrl).then((response) => {
      if (!response.ok) {
        throw new Error("Failed to load popover template");
      }
      return response.text();
    });
  }
  return popoverTemplatePromise;
}

function truncateText(value, maxLength) {
  if (!value) return "";
  if (value.length <= maxLength) return value;
  const trimmed = value.slice(0, Math.max(0, maxLength - 1)).trimEnd();
  return `${trimmed}…`;
}

function buildPopoverContent(template) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(template, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) {
    return document.createDocumentFragment();
  }
  return document.importNode(root, true);
}

function removePopover() {
  if (popover) popover.remove();
  if (popoverBackdrop) popoverBackdrop.remove();
  popover = null;
  popoverBackdrop = null;
}

async function createPopover(selection) {
  removePopover();

  ensurePopoverStyles();
  const template = await loadPopoverTemplate();

  popoverBackdrop = document.createElement("div");
  popoverBackdrop.className = "vc-backdrop";
  popoverBackdrop.addEventListener("click", removePopover);

  popover = document.createElement("div");
  popover.className = "vc-popover";
  popover.appendChild(buildPopoverContent(template));

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
  const sourceUrl = selection.url || "";
  sourceLink.textContent = truncateText(sourceUrl, SOURCE_URL_MAX_LENGTH);
  sourceLink.href = sourceUrl || "#";
  sourceLink.title = sourceUrl;

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
    await createPopover(selection);
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
      (async () => {
        const selection = getSelectionInfo();
        // Use the draft if provided, otherwise default selection info
        if (message.draft) {
          // Ideally we would merge draft info here, but for now let's just use what createPopover expects.
          // Only text is guaranteed.
          await createPopover({ ...selection, ...message.draft });
        } else {
          await createPopover(selection);
        }
        sendResponse({ ok: true });
      })().catch((error) => {
        sendResponse({ ok: false, error: error.message });
      });
      return true;
    }
  });
}
