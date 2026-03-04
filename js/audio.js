import { CHORD_NOTES } from "./data.js";
import { startReactionTimer, stopReactionTimer } from "./timer.js";

let audioContext = null;
let analyser = null;
let micStream = null;
export let listening = false;
export let soundDetected = false;
let animFrame = null;

export function setListening(v) { listening = v; }
export function setSoundDetected(v) { soundDetected = v; }
export function getAnalyser() { return analyser; }

// Callback set by session.js to avoid circular imports
let onDetectedCallback = null;
export function setDetectionCallback(fn) { onDetectedCallback = fn; }

// ─── Mic Setup ────────────────────────────────────────────────────────────────
export async function setupMic() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(micStream);

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 8192;
    analyser.smoothingTimeConstant = 0.5;

    const volAn = audioContext.createAnalyser();
    volAn.fftSize = 256;
    audioContext._volAn = volAn;

    source.connect(analyser);
    source.connect(volAn);

    document.getElementById("mic-status").textContent = "✓ Microphone connected — chord detection active";
    document.getElementById("mic-status").className = "mic-status ok";
    return true;
  } catch (e) {
    document.getElementById("mic-status").textContent = "✗ Mic access denied — using manual mode";
    document.getElementById("mic-status").className = "mic-status err";
    return false;
  }
}

export function getVolume() {
  const an = audioContext && audioContext._volAn;
  if (!an) return 0;
  const data = new Uint8Array(an.frequencyBinCount);
  an.getByteFrequencyData(data);
  return data.reduce((a, b) => a + b, 0) / data.length;
}

// ─── Volume Bars ──────────────────────────────────────────────────────────────
const NUM_BARS = 8;
export function setupVolumeBars() {
  const container = document.getElementById("volume-bars");
  container.innerHTML = "";
  for (let i = 0; i < NUM_BARS; i++) {
    const bar = document.createElement("div");
    bar.className = "volume-bar";
    bar.style.height = "2px";
    container.appendChild(bar);
  }
}

let volHistory = new Array(NUM_BARS).fill(0);

// ─── Detection Accumulator ────────────────────────────────────────────────────
let chordHits = {};
let silentFrames = 0;
const CONFIRM_FRAMES = 7;
const VOL_THRESHOLD = 40;
const MIN_CHORD_SCORE = 0.45;

export function resetDetection() {
  chordHits = {};
  silentFrames = 0;
}

export function animateVolume() {
  if (!listening) return;
  const vol = getVolume();
  const norm = Math.min(1, vol / 40);

  volHistory.push(norm);
  volHistory.shift();
  const bars = document.querySelectorAll(".volume-bar");
  bars.forEach((bar, i) => {
    bar.style.height = Math.max(2, volHistory[i] * 24) + "px";
    bar.style.background = volHistory[i] > 0.5 ? "#e8a940" : "#4a3e28";
  });

  if (soundDetected) {
    animFrame = requestAnimationFrame(animateVolume);
    return;
  }

  if (vol > VOL_THRESHOLD && analyser) {
    silentFrames = 0;
    const { chord, score } = detectChord(analyser, audioContext.sampleRate);
    const conf = Math.round(Math.max(0, score) * 100);
    document.getElementById("listen-sub").textContent = chord
      ? `Hearing: ${chord} (${conf}% match)`
      : "Analyzing…";

    if (chord && score >= MIN_CHORD_SCORE) {
      chordHits[chord] = (chordHits[chord] || 0) + 1;
      const top = Object.entries(chordHits).sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] >= CONFIRM_FRAMES) {
        soundDetected = true;
        listening = false;
        stopReactionTimer();
        if (onDetectedCallback) onDetectedCallback(top[0], score);
      }
    }
  } else {
    silentFrames++;
    if (silentFrames > 8) {
      chordHits = {};
      if (!soundDetected)
        document.getElementById("listen-sub").textContent = "Listening for sound…";
    }
  }

  animFrame = requestAnimationFrame(animateVolume);
}

export function cancelVolumeAnimation() {
  cancelAnimationFrame(animFrame);
}

// ─── Chromagram Chord Detection ───────────────────────────────────────────────
function getChroma(an, sampleRate) {
  const buf = new Float32Array(an.frequencyBinCount);
  an.getFloatFrequencyData(buf);
  const chroma = new Float32Array(12).fill(0);
  const binHz = sampleRate / an.fftSize;

  const minBin = Math.max(1, Math.floor(60 / binHz));
  const maxBin = Math.min(buf.length - 1, Math.ceil(1400 / binHz));

  for (let i = minBin; i <= maxBin; i++) {
    const freq = i * binHz;
    const midi = 12 * Math.log2(freq / 440) + 69;
    const pc = ((Math.round(midi) % 12) + 12) % 12;
    const db = buf[i];
    if (db > -50) chroma[pc] += Math.pow(10, db / 20);
  }

  const maxVal = Math.max(...chroma, 1e-9);
  for (let i = 0; i < 12; i++) chroma[i] /= maxVal;
  return chroma;
}

function scoreChord(chroma, notes) {
  let score = 0;
  for (let pc = 0; pc < 12; pc++) {
    score += notes.includes(pc) ? chroma[pc] : -chroma[pc] * 0.35;
  }
  return score / notes.length;
}

export function detectChord(an, sampleRate) {
  const chroma = getChroma(an, sampleRate);
  let best = null, bestScore = -Infinity;
  for (const [name, notes] of Object.entries(CHORD_NOTES)) {
    const s = scoreChord(chroma, notes);
    if (s > bestScore) { bestScore = s; best = name; }
  }
  return { chord: best, score: bestScore };
}

// ─── Start Listening ──────────────────────────────────────────────────────────
export function startAudioListening() {
  soundDetected = false;
  listening = true;
  chordHits = {};
  silentFrames = 0;

  const pr = document.getElementById("pulse-ring");
  pr.className = "pulse-ring listening";
  pr.style.borderColor = "";
  pr.style.background = "";
  pr.innerHTML = '<span class="mic-icon">🎙</span>';

  document.getElementById("listen-status").textContent = "Strum the chord…";
  document.getElementById("listen-sub").textContent = "Listening for sound…";
  document.getElementById("listen-area").classList.add("active");

  startReactionTimer();
  animateVolume();

  // Manual fallback if no mic
  if (!analyser) {
    setTimeout(() => {
      if (!soundDetected) {
        soundDetected = true;
        document.getElementById("listen-status").textContent = "Manual mode";
        document.getElementById("listen-sub").textContent = "Rate yourself below";
        document.getElementById("rating-section").classList.add("visible");
      }
    }, 2000);
  }
}
