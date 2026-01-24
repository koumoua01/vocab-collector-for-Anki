const api = globalThis.browser ?? chrome;

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

let popover = null;
let popoverBackdrop = null;

function removePopover() {
  if (popover) popover.remove();
  if (popoverBackdrop) popoverBackdrop.remove();
  popover = null;
  popoverBackdrop = null;
}

function createPopover(selection) {
  removePopover();

  popoverBackdrop = document.createElement("div");
  popoverBackdrop.style.cssText = [
    "position: fixed",
    "top: 0",
    "left: 0",
    "width: 100%",
    "height: 100%",
    "z-index: 2147483646",
    "background: rgba(15, 23, 42, 0.35)"
  ].join(";");
  popoverBackdrop.addEventListener("click", removePopover);

  popover = document.createElement("div");
  popover.style.cssText = [
    "position: fixed",
    "top: 24px",
    "right: 24px",
    "width: 340px",
    "max-width: calc(100vw - 48px)",
    "z-index: 2147483647",
    "background: #0f172a",
    "color: #e2e8f0",
    "border: 1px solid #1f2937",
    "border-radius: 14px",
    "box-shadow: 0 12px 30px rgba(15, 23, 42, 0.45)",
    "font-family: 'Segoe UI', system-ui, sans-serif",
    "padding: 14px",
    "display: grid",
    "gap: 10px"
  ].join(";");

  popover.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
      <div style="font-weight:600;font-size:14px;">Vocab Collector</div>
      <button id="vc-close" style="background:transparent;border:none;color:#93c5fd;cursor:pointer;">✕</button>
    </div>
    <label style="display:grid;gap:6px;font-size:12px;">
      Term
      <input id="vc-term" type="text" style="padding:8px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#f8fafc;" />
    </label>
    <label style="display:grid;gap:6px;font-size:12px;">
      Definition
      <textarea id="vc-definition" rows="3" style="padding:8px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#f8fafc;resize:vertical;"></textarea>
    </label>
    <label style="display:grid;gap:6px;font-size:12px;">
      Example
      <textarea id="vc-example" rows="2" style="padding:8px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#f8fafc;resize:vertical;"></textarea>
    </label>
    <div style="font-size:11px;color:#94a3b8;">
      Source: <a id="vc-source" href="#" target="_blank" style="color:#93c5fd;text-decoration:none;"></a>
    </div>
    <div id="vc-status" style="font-size:11px;color:#cbd5f5;">Ready</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
      <button id="vc-ai" style="background:#1f2937;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:8px;cursor:pointer;">AI Define</button>
      <button id="vc-save" style="background:#2563eb;color:#fff;border:none;border-radius:8px;padding:8px;cursor:pointer;">Save</button>
      <button id="vc-dismiss" style="background:transparent;color:#93c5fd;border:1px solid #334155;border-radius:8px;padding:8px;cursor:pointer;">Dismiss</button>
    </div>
  `;

  document.body.appendChild(popoverBackdrop);
  document.body.appendChild(popover);

  const termInput = popover.querySelector("#vc-term");
  const definitionInput = popover.querySelector("#vc-definition");
  const exampleInput = popover.querySelector("#vc-example");
  const sourceLink = popover.querySelector("#vc-source");
  const statusEl = popover.querySelector("#vc-status");

  termInput.value = selection.text || "";
  exampleInput.value = selection.sentence || "";
  sourceLink.textContent = selection.url || "";
  sourceLink.href = selection.url || "#";

  popover.querySelector("#vc-close").addEventListener("click", removePopover);
  popover.querySelector("#vc-dismiss").addEventListener("click", removePopover);

  popover.querySelector("#vc-ai").addEventListener("click", async () => {
    const term = termInput.value.trim();
    if (!term) {
      statusEl.textContent = "Enter a term first.";
      return;
    }
    statusEl.textContent = "Generating definition...";
    try {
      const result = await callBackground({ type: "AI_DEFINE", term });
      if (typeof result === "string") {
        definitionInput.value = result;
      } else {
        definitionInput.value = result.definition || "";
        if (result.example && !exampleInput.value) {
          exampleInput.value = result.example;
        }
      }
      statusEl.textContent = "Definition ready.";
    } catch (error) {
      statusEl.textContent = `Error: ${error.message}`;
    }
  });

  popover.querySelector("#vc-save").addEventListener("click", async () => {
    const payload = {
      term: termInput.value.trim(),
      definition: definitionInput.value.trim(),
      example: exampleInput.value.trim(),
      source: selection.url || "",
      context: exampleInput.value.trim(),
      frontContext: `${termInput.value.trim()}\n${exampleInput.value.trim()}`.trim(),
      backDefOnly: definitionInput.value.trim()
    };

    if (!payload.term) {
      statusEl.textContent = "Term is required.";
      return;
    }

    statusEl.textContent = "Saving to Anki...";
    try {
      await callBackground({ type: "ADD_NOTE", payload });
      statusEl.textContent = "Saved to Anki.";
    } catch (error) {
      statusEl.textContent = `Error: ${error.message}`;
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

document.addEventListener("dblclick", () => {
  const selection = getSelectionInfo();
  if (!selection.text) return;
  createPopover(selection);
});

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;
  if (message.type === "GET_SELECTION") {
    sendResponse(getSelectionInfo());
  }
});
