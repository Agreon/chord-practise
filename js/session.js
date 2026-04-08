import { CHORDS } from "./data.js";
import { getReactionMs, getSpeedClass, combinedScore, cancelTimerAnimation } from "./timer.js";
import { startAudioListening, cancelVolumeAnimation, setExpectedChord } from "./audio.js";
import { saveProgress, showSaveIndicator } from "./storage.js";
import { showChordCard, updateStats, buildChordSelect } from "./ui.js";

// ─── State ────────────────────────────────────────────────────────────────────
export const state = {
  mastery: {},
  attempts: {},
  selectedChords: ["C", "D", "E", "G", "Am", "Em"],
  currentChord: null,
  bestTimes: {},
  autoAdvanceDelay: 2500,
  hideChordDiagram: false,
};

export function applyLoadedData(data) {
  if (data.mastery) state.mastery = data.mastery;
  if (data.attempts) state.attempts = data.attempts;
  if (data.selectedChords && data.selectedChords.length > 0) state.selectedChords = data.selectedChords;
  if (data.bestTimes) state.bestTimes = data.bestTimes;
  if (data.autoAdvanceDelay) state.autoAdvanceDelay = data.autoAdvanceDelay;
  if (data.hideChordDiagram !== undefined) state.hideChordDiagram = data.hideChordDiagram;
}

export function getStateSnapshot() {
  const { mastery, attempts, selectedChords, bestTimes, autoAdvanceDelay, hideChordDiagram } = state;
  return { mastery, attempts, selectedChords, bestTimes, autoAdvanceDelay, hideChordDiagram };
}

// ─── Init ─────────────────────────────────────────────────────────────────────
export function initScores() {
  Object.keys(CHORDS).forEach((name) => {
    if (!(name in state.mastery)) {
      state.mastery[name] = 0;
      state.attempts[name] = 0;
    }
  });
}

// ─── Weighted Random Selection ────────────────────────────────────────────────
function pickChord() {
  const pool = state.selectedChords.filter((c) => c !== state.currentChord);
  const weights = pool.map((c) => Math.max(0.1, 1 - state.mastery[c]));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool.at(-1);
}

// ─── Auto-advance ─────────────────────────────────────────────────────────────
let autoAdvanceTimeout = null;
let autoAdvanceAnimFrame = null;

export function clearAutoAdvance() {
  clearTimeout(autoAdvanceTimeout);
  autoAdvanceTimeout = null;
  cancelAnimationFrame(autoAdvanceAnimFrame);
  autoAdvanceAnimFrame = null;
  const wrapEl = document.getElementById("countdown-wrap");
  if (wrapEl) wrapEl.style.display = "none";
  const highlightEl = document.getElementById("result-highlight");
  if (highlightEl) highlightEl.style.display = "none";
}

export function startAutoAdvance(autoScore, scorePct) {
  clearAutoAdvance();

  const wrapEl = document.getElementById("countdown-wrap");
  const barEl = document.getElementById("countdown-bar-fill");
  const labelEl = document.getElementById("countdown-label");
  const highlightEl = document.getElementById("result-highlight");

  let color;
  if (scorePct > 70) color = "var(--green)";
  else if (scorePct > 40) color = "var(--amber)";
  else color = "var(--red)";
  highlightEl.innerHTML = `<span class="result-score-big" style="color:${color}">${scorePct}<span class="result-score-pct-small">%</span></span>`;
  highlightEl.style.display = "block";

  wrapEl.style.display = "block";
  barEl.style.transition = "none";
  barEl.style.width = "100%";
  barEl.getBoundingClientRect();
  barEl.style.transition = `width ${state.autoAdvanceDelay}ms linear`;
  barEl.style.width = "0%";

  const start = performance.now();
  function tick() {
    const elapsed = performance.now() - start;
    const remaining = Math.max(0, (state.autoAdvanceDelay - elapsed) / 1000);
    labelEl.textContent = `Next chord in ${remaining.toFixed(1)}s`;
    if (elapsed < state.autoAdvanceDelay) {
      autoAdvanceAnimFrame = requestAnimationFrame(tick);
    }
  }
  autoAdvanceAnimFrame = requestAnimationFrame(tick);

  autoAdvanceTimeout = setTimeout(() => {
    handleRating(autoScore);
  }, state.autoAdvanceDelay);
}

// ─── Chord Detection Result ───────────────────────────────────────────────────
export function onChordDetected(detected, score) {
  const reactionMs = getReactionMs();
  const correct = detected === state.currentChord;
  const conf = Math.round(Math.max(0, score) * 100);
  const sClass = getSpeedClass(reactionMs);

  let speedLabel;
  if (sClass === "fast") speedLabel = "⚡ Fast";
  else if (sClass === "medium") speedLabel = "👍 OK";
  else speedLabel = "🐢 Slow";

  const pr = document.getElementById("pulse-ring");
  pr.className = "pulse-ring detected";

  if (correct) {
    pr.innerHTML = '<span style="font-size:18px">✓</span>';
    pr.style.borderColor = "var(--green)";
    pr.style.background = "rgba(78,203,113,0.2)";
    document.getElementById("listen-status").textContent = `${detected} — correct!`;
    document.getElementById("listen-sub").textContent = `Confidence: ${conf}%`;
  } else {
    pr.innerHTML = '<span style="font-size:18px">✗</span>';
    pr.style.borderColor = "var(--red)";
    pr.style.background = "rgba(232,92,92,0.2)";
    document.getElementById("listen-status").textContent = `Heard: ${detected}`;
    document.getElementById("listen-sub").textContent = `Expected ${state.currentChord}`;
  }

  document.getElementById("listen-area").classList.remove("active");

  const speedBadge = `<span class="speed-badge ${sClass}">${speedLabel} · ${(reactionMs / 1000).toFixed(1)}s</span>`;
  const prompt = document.querySelector(".rating-prompt");
  if (correct) {
    prompt.innerHTML = `✓ <strong style="color:var(--green)">${detected}</strong> · ${conf}% conf ${speedBadge}`;
  } else {
    prompt.innerHTML = `Heard <strong style="color:var(--red)">${detected}</strong>, expected <strong style="color:var(--amber)">${state.currentChord}</strong> ${speedBadge}`;
  }

  const autoScore = correct ? 1 : 0;
  const scorePct = Math.round(combinedScore(autoScore, reactionMs) * 100);

  setTimeout(() => {
    document.getElementById("rating-section").classList.add("visible");
    startAutoAdvance(autoScore, scorePct);
  }, 300);
}

// ─── Rating Handler ───────────────────────────────────────────────────────────
export function handleRating(correctnessScore) {
  clearAutoAdvance();
  const name = state.currentChord;
  state.attempts[name]++;
  const alpha = 0.3;
  const reactionMs = getReactionMs();
  const final = combinedScore(correctnessScore, reactionMs);
  state.mastery[name] = state.mastery[name] * (1 - alpha) + final * alpha;

  if (correctnessScore > 0 && reactionMs !== null) {
    if (!state.bestTimes[name] || reactionMs < state.bestTimes[name]) {
      state.bestTimes[name] = reactionMs;
    }
  }

  updateStats(state.selectedChords, state.mastery, state.attempts, state.bestTimes);
  saveProgress(getStateSnapshot()).then(() => showSaveIndicator());
  setTimeout(nextChord, 200);
}

// ─── Next / Show Chord ────────────────────────────────────────────────────────
export function nextChord() {
  if (state.selectedChords.length === 0) return;
  state.currentChord = state.selectedChords.length === 1 ? state.selectedChords[0] : pickChord();

  showChordCard(state.currentChord, state.mastery[state.currentChord]);
  document.querySelector(".diagram-wrap").style.display = state.hideChordDiagram ? "none" : "";

  clearAutoAdvance();
  document.getElementById("rating-section").classList.remove("visible");
  document.querySelector(".rating-prompt").textContent = "How did that sound?";

  setExpectedChord(state.currentChord);
  startAudioListening();
}

// ─── Reset Progress ───────────────────────────────────────────────────────────
export async function resetProgress() {
  state.mastery = {};
  state.attempts = {};
  state.bestTimes = {};
  Object.keys(CHORDS).forEach((name) => {
    state.mastery[name] = 0;
    state.attempts[name] = 0;
  });
  await saveProgress(getStateSnapshot());
  updateStats(state.selectedChords, state.mastery, state.attempts, state.bestTimes);
  showSaveIndicator("Progress reset");
}

// ─── Chord Toggle ─────────────────────────────────────────────────────────────
export function toggleChord(name, btn) {
  if (state.selectedChords.includes(name)) {
    if (state.selectedChords.length > 1) {
      state.selectedChords = state.selectedChords.filter((c) => c !== name);
      btn.classList.remove("selected");
    }
  } else {
    state.selectedChords.push(name);
    btn.classList.add("selected");
  }
  saveProgress(getStateSnapshot());
}

// ─── Stop Session ─────────────────────────────────────────────────────────────
export function stopSession() {
  cancelVolumeAnimation();
  cancelTimerAnimation();
  clearAutoAdvance();
  buildChordSelect(state.selectedChords, Object.keys(CHORDS), toggleChord);
  document.getElementById("practice-screen").style.display = "none";
  document.getElementById("setup-screen").style.display = "block";
}

// ─── Delay Slider Sync ────────────────────────────────────────────────────────
export function syncDelaySlider() {
  const slider = document.getElementById("advance-delay-slider");
  const valueEl = document.getElementById("advance-delay-value");
  if (slider) slider.value = state.autoAdvanceDelay / 1000;
  if (valueEl) valueEl.textContent = (state.autoAdvanceDelay / 1000).toFixed(1) + "s";
}
