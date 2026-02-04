import { getHistory } from "../shared/storage.js";

const api = globalThis.browser?.runtime?.sendMessage ? globalThis.browser : globalThis.chrome;
const historyList = document.getElementById("history");
const clearHistoryButton = document.getElementById("clear-history");
const openOptionsButton = document.getElementById("open-options");
const openHelpButton = document.getElementById("open-help");
const addVocabButton = document.getElementById("add-vocab");

function renderHistory(items) {
  historyList.innerHTML = "";
  if (!items || !items.length) {
    const li = document.createElement("li");
    li.textContent = "No items yet.";
    historyList.appendChild(li);
    return;
  }
  items.forEach((item) => {
    const li = document.createElement("li");
    const title = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = item.word || "";
    title.appendChild(strong);
    const definition = document.createElement("div");
    definition.className = "meta";
    definition.textContent = item.definitions || "";
    const source = document.createElement("div");
    source.className = "meta";
    source.textContent = item.source || "";
    li.appendChild(title);
    li.appendChild(definition);
    li.appendChild(source);
    historyList.appendChild(li);
  });
}

async function initialize() {
  const history = await getHistory();
  renderHistory(history);
  api.runtime.sendMessage({ type: "CLEAR_BADGE" });
}

if (addVocabButton) {
  addVocabButton.addEventListener("click", async () => {
    try {
      const [tab] = await api.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;
      await api.tabs.sendMessage(tab.id, { type: "SHOW_POPOVER" });
      window.close();
    } catch (error) {
      console.error("Failed to open popover:", error);
    }
  });
}

if (openOptionsButton) {
  openOptionsButton.addEventListener("click", () => {
    if (api.runtime.openOptionsPage) {
      api.runtime.openOptionsPage();
    } else {
      window.open(api.runtime.getURL("options/options.html"));
    }
  });
}

if (openHelpButton) {
  openHelpButton.addEventListener("click", () => {
    window.open(api.runtime.getURL("help/help.html"));
  });
}

if (clearHistoryButton) {
  clearHistoryButton.addEventListener("click", async () => {
    await api.storage.local.set({ history: [] });
    renderHistory([]);
  });
}

initialize();
