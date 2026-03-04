// ─── Chord Data ───────────────────────────────────────────────────────────────
// Format: strings from low E to high e (0=open, -1=muted, 1-12=fret)
// barre: { fret, from, to } optional
const CHORDS = {
  C: { type: "Major", fingers: [-1, 3, 2, 0, 1, 0], barre: null },
  D: { type: "Major", fingers: [-1, -1, 0, 2, 3, 2], barre: null },
  E: { type: "Major", fingers: [0, 2, 2, 1, 0, 0], barre: null },
  G: { type: "Major", fingers: [3, 2, 0, 0, 0, 3], barre: null },
  A: { type: "Major", fingers: [-1, 0, 2, 2, 2, 0], barre: null },
  Am: { type: "Minor", fingers: [-1, 0, 2, 2, 1, 0], barre: null },
  Em: { type: "Minor", fingers: [0, 2, 2, 0, 0, 0], barre: null },
  Dm: { type: "Minor", fingers: [-1, -1, 0, 2, 3, 1], barre: null },
  F: {
    type: "Major",
    fingers: [1, 1, 2, 3, 3, 1],
    barre: { fret: 1, from: 0, to: 5 },
  },
  Bm: {
    type: "Minor",
    fingers: [-1, 2, 4, 4, 3, 2],
    barre: { fret: 2, from: 1, to: 5 },
  },
  C7: { type: "Dominant 7", fingers: [-1, 3, 2, 3, 1, 0], barre: null },
  G7: { type: "Dominant 7", fingers: [3, 2, 0, 0, 0, 1], barre: null },
  D7: { type: "Dominant 7", fingers: [-1, -1, 0, 2, 1, 2], barre: null },
  A7: { type: "Dominant 7", fingers: [-1, 0, 2, 0, 2, 0], barre: null },
  E7: { type: "Dominant 7", fingers: [0, 2, 2, 1, 3, 0], barre: null },
  Cadd9: { type: "Add 9", fingers: [-1, 3, 2, 0, 3, 0], barre: null },
};

// ─── State ────────────────────────────────────────────────────────────────────
let mastery = {}; // chord name -> 0..1
let attempts = {}; // chord name -> count
let selectedChords = ["C", "D", "E", "G", "Am", "Em"];
let currentChord = null;
let audioContext = null;
let analyser = null;
let micStream = null;
let listening = false;
let soundDetected = false;
let animFrame = null;

// Reaction timer
let chordShownAt = null; // timestamp when chord was displayed
let reactionMs = null; // ms taken to play after chord shown
let timerAnimFrame = null;
const MAX_REACTION_TIME = 8000; // 8s = "slow", anything over is 0 speed score
const FAST_THRESHOLD = 2000; // under 2s = fast
const MEDIUM_THRESHOLD = 5000; // under 5s = medium

// Auto-advance
let autoAdvanceDelay = 2500; // ms, user-adjustable
let autoAdvanceTimeout = null;
let autoAdvanceAnimFrame = null;

let bestTimes = {}; // chord name → best reaction time in ms (correct only)

// ─── Init chord scores ─────────────────────────────────────────────────────────
function initScores() {
  Object.keys(CHORDS).forEach((name) => {
    if (!(name in mastery)) {
      mastery[name] = 0;
      attempts[name] = 0;
    }
  });
}

// ─── Weighted random selection ─────────────────────────────────────────────────
function pickChord() {
  const pool = selectedChords.filter((c) => c !== currentChord);
  const weights = pool.map((c) => Math.max(0.1, 1 - mastery[c]));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

// ─── Chord SVG Diagram ─────────────────────────────────────────────────────────
function drawChord(name) {
  const chord = CHORDS[name];
  const fingers = chord.fingers;
  const barre = chord.barre;

  const strings = 6;
  const frets = 4;
  const cellW = 38,
    cellH = 36;
  const padL = 24,
    padT = 40,
    padR = 20,
    padB = 16;
  const W = padL + cellW * (strings - 1) + padR;
  const H = padT + cellH * frets + padB;

  // Find min fret (non-zero, non-muted)
  const usedFrets = fingers.filter((f) => f > 0);
  const minFret = usedFrets.length ? Math.min(...usedFrets) : 1;
  const startFret = minFret <= 2 ? 1 : minFret - 1;

  let svg = `<svg class="chord-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;

  // Nut or fret indicator
  if (startFret === 1) {
    svg += `<rect x="${padL}" y="${padT - 5}" width="${cellW * (strings - 1)}" height="6" rx="2" fill="#c8a96e"/>`;
  } else {
    svg += `<text x="${padL - 6}" y="${padT + cellH * 0.6}" text-anchor="end" font-family="DM Mono,monospace" font-size="11" fill="#6e6860">${startFret}fr</text>`;
  }

  // Fret lines
  for (let f = 0; f <= frets; f++) {
    const y = padT + f * cellH;
    svg += `<line x1="${padL}" y1="${y}" x2="${padL + cellW * (strings - 1)}" y2="${y}" stroke="rgba(255,255,255,0.1)" stroke-width="${f === 0 ? 1.5 : 1}"/>`;
  }

  // String lines
  for (let s = 0; s < strings; s++) {
    const x = padL + s * cellW;
    svg += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + frets * cellH}" stroke="rgba(200,169,110,0.35)" stroke-width="1.5"/>`;
  }

  // Barre
  if (barre) {
    const y = padT + (barre.fret - startFret + 0.5) * cellH;
    const x1 = padL + barre.from * cellW;
    const x2 = padL + barre.to * cellW;
    svg += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#e8a940" stroke-width="18" stroke-linecap="round" opacity="0.85"/>`;
  }

  // Finger dots
  for (let s = 0; s < strings; s++) {
    const fret = fingers[s];
    const x = padL + s * cellW;

    if (fret === -1) {
      // Muted
      svg += `<text x="${x}" y="${padT - 14}" text-anchor="middle" font-size="12" fill="#6e6860">✕</text>`;
    } else if (fret === 0) {
      // Open
      svg += `<circle cx="${x}" cy="${padT - 14}" r="5" fill="none" stroke="#6e6860" stroke-width="1.5"/>`;
    } else {
      const fy = padT + (fret - startFret + 0.5) * cellH;
      // Skip if covered by barre
      if (barre && fret === barre.fret && s >= barre.from && s <= barre.to) {
        // Just dot on top of barre for clarity
        svg += `<circle cx="${x}" cy="${fy}" r="8" fill="#e8a940"/>`;
      } else {
        svg += `<circle cx="${x}" cy="${fy}" r="9" fill="#e8a940"/>`;
      }
    }
  }

  // String labels
  const labels = ["E", "A", "D", "G", "B", "e"];
  for (let s = 0; s < strings; s++) {
    const x = padL + s * cellW;
    svg += `<text x="${x}" y="${H - 2}" text-anchor="middle" font-family="DM Mono,monospace" font-size="9" fill="#4a4540" letter-spacing="0">${labels[s]}</text>`;
  }

  svg += "</svg>";
  document.getElementById("fretboard").innerHTML = svg;
}

// ─── Reaction Timer ───────────────────────────────────────────────────────────
const CIRCUMFERENCE = 2 * Math.PI * 38; // matches r=38 in SVG

function startReactionTimer() {
  chordShownAt = performance.now();
  reactionMs = null;
  updateTimerUI(0);
  cancelAnimationFrame(timerAnimFrame);
  animateTimer();
}

function stopReactionTimer() {
  reactionMs = performance.now() - chordShownAt;
  cancelAnimationFrame(timerAnimFrame);
  updateTimerUI(reactionMs);
}

function animateTimer() {
  if (!chordShownAt || reactionMs !== null) return;
  const elapsed = performance.now() - chordShownAt;
  updateTimerUI(elapsed);
  timerAnimFrame = requestAnimationFrame(animateTimer);
}

function getSpeedClass(ms) {
  if (ms <= FAST_THRESHOLD) return "fast";
  if (ms <= MEDIUM_THRESHOLD) return "medium";
  return "slow";
}

function updateTimerUI(ms) {
  const arc = document.getElementById("timer-arc");
  const secEl = document.getElementById("timer-seconds");
  if (!arc || !secEl) return;

  const capped = Math.min(ms, MAX_REACTION_TIME);
  const frac = capped / MAX_REACTION_TIME; // 0 → 1 as time increases
  const offset = CIRCUMFERENCE * frac; // arc drains clockwise
  arc.style.strokeDashoffset = offset;

  const sClass = getSpeedClass(ms);
  arc.className = "timer-arc " + sClass;
  secEl.className = "timer-seconds " + sClass;
  secEl.textContent = (ms / 1000).toFixed(1);
}

// Convert reaction time to a 0–1 speed score
function reactionScore(ms) {
  if (ms === null) return 0;
  if (ms <= FAST_THRESHOLD) return 1.0;
  if (ms >= MAX_REACTION_TIME) return 0.0;
  // Linear ramp between fast and max
  return 1 - (ms - FAST_THRESHOLD) / (MAX_REACTION_TIME - FAST_THRESHOLD);
}

// Combine correctness (0/0.5/1) and speed into a single mastery delta
function combinedScore(correctnessScore, ms) {
  const speed = reactionScore(ms);
  // Correctness is weighted 60%, speed 40%
  // If chord is wrong, speed doesn't help much
  if (correctnessScore === 0) return 0;
  return correctnessScore * 0.6 + speed * 0.4 * correctnessScore;
}

// ─── Chord → Notes mapping (pitch classes 0=C, 1=C#, ..., 11=B) ──────────────
const CHORD_NOTES = {
  C: [0, 4, 7],
  D: [2, 6, 9],
  E: [4, 8, 11],
  G: [7, 11, 2],
  A: [9, 1, 4],
  Am: [9, 0, 4],
  Em: [4, 7, 11],
  Dm: [2, 5, 9],
  F: [5, 9, 0],
  Bm: [11, 2, 6],
  C7: [0, 4, 7, 10],
  G7: [7, 11, 2, 5],
  D7: [2, 6, 9, 0],
  A7: [9, 1, 4, 7],
  E7: [4, 8, 11, 2],
  Cadd9: [0, 4, 7, 2],
};

// ─── Chromagram-based chord detection ─────────────────────────────────────────
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

function detectChord(an, sampleRate) {
  const chroma = getChroma(an, sampleRate);
  let best = null,
    bestScore = -Infinity;
  for (const [name, notes] of Object.entries(CHORD_NOTES)) {
    const s = scoreChord(chroma, notes);
    if (s > bestScore) {
      bestScore = s;
      best = name;
    }
  }
  return { chord: best, score: bestScore };
}

// ─── Microphone Setup ─────────────────────────────────────────────────────────
async function setupMic() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(micStream);

    // Large-FFT analyser for chord detection
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 8192;
    analyser.smoothingTimeConstant = 0.5;

    // Small-FFT analyser for volume bars
    const volAn = audioContext.createAnalyser();
    volAn.fftSize = 256;
    audioContext._volAn = volAn;

    source.connect(analyser);
    source.connect(volAn);

    document.getElementById("mic-status").textContent =
      "✓ Microphone connected — chord detection active";
    document.getElementById("mic-status").className = "mic-status ok";
    return true;
  } catch (e) {
    document.getElementById("mic-status").textContent =
      "✗ Mic access denied — using manual mode";
    document.getElementById("mic-status").className = "mic-status err";
    return false;
  }
}

function getVolume() {
  const an = audioContext && audioContext._volAn;
  if (!an) return 0;
  const data = new Uint8Array(an.frequencyBinCount);
  an.getByteFrequencyData(data);
  return data.reduce((a, b) => a + b, 0) / data.length;
}

// ─── Volume bars animation ────────────────────────────────────────────────────
const NUM_BARS = 8;
function setupVolumeBars() {
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

// Detection accumulator — chord must win N consecutive frames
let chordHits = {};
let silentFrames = 0;
const CONFIRM_FRAMES = 7;
const VOL_THRESHOLD = 40;
const MIN_CHORD_SCORE = 0.45;

function animateVolume() {
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
        onChordDetected(top[0], score);
      }
    }
  } else {
    silentFrames++;
    if (silentFrames > 8) {
      chordHits = {};
      if (!soundDetected)
        document.getElementById("listen-sub").textContent =
          "Listening for sound…";
    }
  }

  animFrame = requestAnimationFrame(animateVolume);
}

function onChordDetected(detected, score) {
  cancelAnimationFrame(animFrame);
  listening = false;
  stopReactionTimer(); // ← capture elapsed time

  const correct = detected === currentChord;
  const conf = Math.round(Math.max(0, score) * 100);
  const sClass = getSpeedClass(reactionMs);
  const speedLabel =
    sClass === "fast" ? "⚡ Fast" : sClass === "medium" ? "👍 OK" : "🐢 Slow";

  const pr = document.getElementById("pulse-ring");
  pr.className = "pulse-ring detected";

  if (correct) {
    pr.innerHTML = '<span style="font-size:18px">✓</span>';
    pr.style.borderColor = "var(--green)";
    pr.style.background = "rgba(78,203,113,0.2)";
    document.getElementById("listen-status").textContent =
      `${detected} — correct!`;
    document.getElementById("listen-sub").textContent = `Confidence: ${conf}%`;
  } else {
    pr.innerHTML = '<span style="font-size:18px">✗</span>';
    pr.style.borderColor = "var(--red)";
    pr.style.background = "rgba(232,92,92,0.2)";
    document.getElementById("listen-status").textContent = `Heard: ${detected}`;
    document.getElementById("listen-sub").textContent =
      `Expected ${currentChord}`;
  }

  document.getElementById("listen-area").classList.remove("active");

  const speedBadge = `<span class="speed-badge ${sClass}">${speedLabel} · ${(reactionMs / 1000).toFixed(1)}s</span>`;
  const prompt = document.querySelector(".rating-prompt");
  if (correct) {
    prompt.innerHTML = `✓ <strong style="color:var(--green)">${detected}</strong> · ${conf}% conf ${speedBadge}<br><small style="opacity:0.6">Override below if needed</small>`;
  } else {
    prompt.innerHTML = `Heard <strong style="color:var(--red)">${detected}</strong>, expected <strong style="color:var(--amber)">${currentChord}</strong> ${speedBadge}<br><small style="opacity:0.6">How did it actually sound?</small>`;
  }

  const autoScore = correct ? 1 : 0;
  const scorePct = Math.round(combinedScore(autoScore, reactionMs) * 100);

  setTimeout(() => {
    document.getElementById("rating-section").classList.add("visible");
    startAutoAdvance(autoScore, scorePct);
  }, 300);
}

// ─── Start listening ──────────────────────────────────────────────────────────
function startListening() {
  clearAutoAdvance();
  soundDetected = false;
  listening = true;
  chordHits = {};
  silentFrames = 0;

  document.getElementById("rating-section").classList.remove("visible");
  document.querySelector(".rating-prompt").textContent = "How did that sound?";

  const pr = document.getElementById("pulse-ring");
  pr.className = "pulse-ring listening";
  pr.style.borderColor = "";
  pr.style.background = "";
  pr.innerHTML = '<span class="mic-icon">🎙</span>';

  document.getElementById("listen-status").textContent = "Strum the chord…";
  document.getElementById("listen-sub").textContent = "Listening for sound…";
  document.getElementById("listen-area").classList.add("active");

  startReactionTimer(); // ← start timing from when chord is shown
  animateVolume();

  // Manual fallback if no mic
  if (!analyser) {
    setTimeout(() => {
      if (!soundDetected) {
        soundDetected = true;
        document.getElementById("listen-status").textContent = "Manual mode";
        document.getElementById("listen-sub").textContent =
          "Rate yourself below";
        document.getElementById("rating-section").classList.add("visible");
      }
    }, 2000);
  }
}

// ─── Auto-advance ─────────────────────────────────────────────────────────────
function startAutoAdvance(autoScore, scorePct) {
  clearAutoAdvance();

  const wrapEl = document.getElementById("countdown-wrap");
  const barEl = document.getElementById("countdown-bar-fill");
  const labelEl = document.getElementById("countdown-label");
  const highlightEl = document.getElementById("result-highlight");

  // Score color
  let color;
  if (scorePct > 70) color = "var(--green)";
  else if (scorePct > 40) color = "var(--amber)";
  else color = "var(--red)";
  highlightEl.innerHTML = `<span class="result-score-big" style="color:${color}">${scorePct}<span class="result-score-pct-small">%</span></span>`;
  highlightEl.style.display = "block";

  // Countdown bar: CSS transition full → empty
  wrapEl.style.display = "block";
  barEl.style.transition = "none";
  barEl.style.width = "100%";
  barEl.getBoundingClientRect(); // force reflow
  barEl.style.transition = `width ${autoAdvanceDelay}ms linear`;
  barEl.style.width = "0%";

  // Animated label
  const start = performance.now();
  function tick() {
    const elapsed = performance.now() - start;
    const remaining = Math.max(0, (autoAdvanceDelay - elapsed) / 1000);
    labelEl.textContent = `Next chord in ${remaining.toFixed(1)}s — tap below to rate`;
    if (elapsed < autoAdvanceDelay) {
      autoAdvanceAnimFrame = requestAnimationFrame(tick);
    }
  }
  autoAdvanceAnimFrame = requestAnimationFrame(tick);

  autoAdvanceTimeout = setTimeout(() => {
    handleRating(autoScore);
  }, autoAdvanceDelay);
}

function clearAutoAdvance() {
  clearTimeout(autoAdvanceTimeout);
  autoAdvanceTimeout = null;
  cancelAnimationFrame(autoAdvanceAnimFrame);
  autoAdvanceAnimFrame = null;
  const wrapEl = document.getElementById("countdown-wrap");
  if (wrapEl) wrapEl.style.display = "none";
  const highlightEl = document.getElementById("result-highlight");
  if (highlightEl) highlightEl.style.display = "none";
}

// ─── Rating handler ───────────────────────────────────────────────────────────
function handleRating(correctnessScore) {
  clearAutoAdvance();
  const name = currentChord;
  attempts[name]++;
  const alpha = 0.3;
  const final = combinedScore(correctnessScore, reactionMs);
  mastery[name] = mastery[name] * (1 - alpha) + final * alpha;

  // Track personal best time only on correct plays
  if (correctnessScore > 0 && reactionMs !== null) {
    if (!bestTimes[name] || reactionMs < bestTimes[name]) {
      bestTimes[name] = reactionMs;
    }
  }

  updateStats();
  saveProgress().then(() => showSaveIndicator());
  setTimeout(nextChord, 200);
}

// ─── Next chord ───────────────────────────────────────────────────────────────
function nextChord() {
  if (selectedChords.length === 0) return;
  currentChord = selectedChords.length === 1 ? selectedChords[0] : pickChord();
  showChord(currentChord);
}

function showChord(name) {
  const chord = CHORDS[name];
  const el = document.getElementById("chord-name");
  el.textContent = name;
  el.classList.remove("flash");
  void el.offsetWidth;
  el.classList.add("flash");
  document.getElementById("chord-type").textContent = chord.type;
  drawChord(name);

  const m = mastery[name];
  const pct = Math.round(m * 100);
  document.getElementById("mastery-bar").style.width = pct + "%";
  document.getElementById("mastery-pct").textContent = pct + "%";
  const fill = document.getElementById("mastery-bar");
  if (pct > 70)
    fill.style.background = "linear-gradient(90deg, #2d7a45, #4ecb71)";
  else if (pct > 40)
    fill.style.background =
      "linear-gradient(90deg, var(--amber-dim), var(--amber))";
  else fill.style.background = "linear-gradient(90deg, #7a2d2d, #cb4e4e)";

  startListening();
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function updateStats() {
  const grid = document.getElementById("chord-stats-grid");
  grid.innerHTML = "";
  selectedChords.forEach((name) => {
    const m = mastery[name];
    const pct = Math.round(m * 100);
    const color = pct > 70 ? "#4ecb71" : pct > 40 ? "#e8a940" : "#e85c5c";
    const best = bestTimes[name];
    const bestStr = best ? (best / 1000).toFixed(1) + "s" : "—";
    const div = document.createElement("div");
    div.className = "chord-stat";
    div.innerHTML = `
      <div class="chord-stat-name">${name}</div>
      <div class="chord-stat-bar-bg">
        <div class="chord-stat-bar" style="width:${pct}%;background:${color}"></div>
      </div>
      <div class="chord-stat-pct">${pct}% · ${attempts[name] || 0} tries · best ${bestStr}</div>
    `;
    grid.appendChild(div);
  });
}

// ─── Setup screen ─────────────────────────────────────────────────────────────
function buildChordSelect() {
  const grid = document.getElementById("chord-select-grid");
  grid.innerHTML = "";
  Object.keys(CHORDS).forEach((name) => {
    const btn = document.createElement("button");
    btn.className =
      "chord-toggle" + (selectedChords.includes(name) ? " selected" : "");
    btn.textContent = name;
    btn.onclick = () => {
      if (selectedChords.includes(name)) {
        if (selectedChords.length > 1) {
          selectedChords = selectedChords.filter((c) => c !== name);
          btn.classList.remove("selected");
        }
      } else {
        selectedChords.push(name);
        btn.classList.add("selected");
      }
      saveProgress();
    };
    grid.appendChild(btn);
  });
}

// ─── Persistence ─────────────────────────────────────────────────────────────
async function saveProgress() {
  try {
    await window.storage.set(
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

async function loadProgress() {
  try {
    const result = await window.storage.get("guitar-progress");
    if (result && result.value) {
      const data = JSON.parse(result.value);
      if (data.mastery) mastery = data.mastery;
      if (data.attempts) attempts = data.attempts;
      if (data.selectedChords && data.selectedChords.length > 0)
        selectedChords = data.selectedChords;
      if (data.bestTimes) bestTimes = data.bestTimes;
      if (data.autoAdvanceDelay) autoAdvanceDelay = data.autoAdvanceDelay;
      return true;
    }
  } catch (e) {}
  return false;
}

async function resetProgress() {
  mastery = {};
  attempts = {};
  bestTimes = {};
  Object.keys(CHORDS).forEach((name) => {
    mastery[name] = 0;
    attempts[name] = 0;
  });
  await saveProgress();
  updateStats();
  showSaveIndicator("Progress reset");
}

function showSaveIndicator(msg = "Saved") {
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

// ─── Delay slider sync ────────────────────────────────────────────────────────
function syncDelaySlider() {
  const slider = document.getElementById("advance-delay-slider");
  const valueEl = document.getElementById("advance-delay-value");
  if (slider) slider.value = autoAdvanceDelay / 1000;
  if (valueEl) valueEl.textContent = (autoAdvanceDelay / 1000).toFixed(1) + "s";
}

// ─── Stop session ─────────────────────────────────────────────────────────────
function stopSession() {
  listening = false;
  cancelAnimationFrame(animFrame);
  cancelAnimationFrame(timerAnimFrame);
  clearAutoAdvance();
  buildChordSelect();
  document.getElementById("practice-screen").style.display = "none";
  document.getElementById("setup-screen").style.display = "block";
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
(async () => {
  const hadSave = await loadProgress();
  initScores();
  buildChordSelect();
  setupVolumeBars();
  syncDelaySlider();

  if (hadSave) {
    // Show a subtle "welcome back" indicator on the setup screen
    const status = document.getElementById("mic-status");
    status.textContent = "✓ Progress loaded from last session";
    status.className = "mic-status ok";
    // Rebuild chord toggles to reflect loaded selectedChords
    buildChordSelect();
  }
  await setupMic();
})();

document.getElementById("start-btn").onclick = () => {
  document.getElementById("setup-screen").style.display = "none";
  document.getElementById("practice-screen").style.display = "block";
  nextChord();
};

document.getElementById("skip-btn").onclick = () => {
  listening = false;
  cancelAnimationFrame(animFrame);
  cancelAnimationFrame(timerAnimFrame);
  nextChord();
};

document.getElementById("settings-btn").onclick = stopSession;

document.getElementById("end-btn").onclick = stopSession;

document.getElementById("advance-delay-slider").oninput = (e) => {
  autoAdvanceDelay = Number.parseFloat(e.target.value) * 1000;
  document.getElementById("advance-delay-value").textContent =
    Number.parseFloat(e.target.value).toFixed(1) + "s";
  saveProgress();
};

document.querySelectorAll(".rating-btn").forEach((btn) => {
  btn.onclick = () => handleRating(parseFloat(btn.dataset.rating));
});
