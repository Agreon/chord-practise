// All functions accept state as parameters to avoid circular imports with session.js

// window.storage is a custom API in some environments; fall back to localStorage
const store = window["storage"] ?? {
  get: (key) => Promise.resolve({ value: localStorage.getItem(key) }),
  set: (key, val) => Promise.resolve(localStorage.setItem(key, val)),
};

export async function saveProgress({
  mastery,
  attempts,
  selectedChords,
  bestTimes,
  autoAdvanceDelay,
}) {
  try {
    await store.set(
      "guitar-progress",
      JSON.stringify({
        mastery,
        attempts,
        selectedChords,
        bestTimes,
        autoAdvanceDelay,
      }),
    );
  } catch (e) {
    console.warn("Could not save progress:", e);
  }
}

export async function loadProgress() {
  try {
    const result = await store.get("guitar-progress");
    if (result && result.value) {
      return JSON.parse(result.value);
    }
  } catch (e) {
    console.warn("Could not load progress:", e);
  }

  return null;
}

export function showSaveIndicator(msg = "Saved") {
  let el = document.getElementById("save-indicator");
  if (!el) {
    el = document.createElement("div");
    el.id = "save-indicator";
    el.style.cssText = `
      position: fixed; bottom: 24px; right: 24px;
      background: var(--surface2); border: 1px solid rgba(232,169,64,0.3);
      color: var(--amber); font-family: 'DM Mono', monospace;
      font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase;
      padding: 8px 14px; border-radius: 3px;
      opacity: 0; transition: opacity 0.3s; pointer-events: none; z-index: 999;
    `;
    document.body.appendChild(el);
  }
  el.textContent = "💾 " + msg;
  el.style.opacity = "1";
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => {
    el.style.opacity = "0";
  }, 1800);
}
