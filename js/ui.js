import { CHORDS } from "./data.js";

// ─── Chord SVG Diagram ────────────────────────────────────────────────────────
export function drawChord(name) {
  const chord = CHORDS[name];
  const fingers = chord.fingers;
  const barre = chord.barre;

  const strings = 6, frets = 4;
  const cellW = 38, cellH = 36;
  const padL = 24, padT = 40, padR = 20, padB = 16;
  const W = padL + cellW * (strings - 1) + padR;
  const H = padT + cellH * frets + padB;

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
      svg += `<text x="${x}" y="${padT - 14}" text-anchor="middle" font-size="12" fill="#6e6860">✕</text>`;
    } else if (fret === 0) {
      svg += `<circle cx="${x}" cy="${padT - 14}" r="5" fill="none" stroke="#6e6860" stroke-width="1.5"/>`;
    } else {
      const fy = padT + (fret - startFret + 0.5) * cellH;
      if (barre && fret === barre.fret && s >= barre.from && s <= barre.to) {
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

// ─── Show Chord Card ──────────────────────────────────────────────────────────
export function showChordCard(name, masteryValue) {
  const chord = CHORDS[name];
  const el = document.getElementById("chord-name");
  el.textContent = name;
  el.classList.remove("flash");
  void el.offsetWidth;
  el.classList.add("flash");
  document.getElementById("chord-type").textContent = chord.type;
  drawChord(name);

  const pct = Math.round(masteryValue * 100);
  document.getElementById("mastery-bar").style.width = pct + "%";
  document.getElementById("mastery-pct").textContent = pct + "%";
  const fill = document.getElementById("mastery-bar");
  if (pct > 70)      fill.style.background = "linear-gradient(90deg, #2d7a45, #4ecb71)";
  else if (pct > 40) fill.style.background = "linear-gradient(90deg, var(--amber-dim), var(--amber))";
  else               fill.style.background = "linear-gradient(90deg, #7a2d2d, #cb4e4e)";
}

// ─── Stats Panel ──────────────────────────────────────────────────────────────
export function updateStats(selectedChords, mastery, attempts, bestTimes) {
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

// ─── Chord Selection Grid ─────────────────────────────────────────────────────
export function buildChordSelect(selectedChords, allChordNames, onToggle) {
  const grid = document.getElementById("chord-select-grid");
  grid.innerHTML = "";
  allChordNames.forEach((name) => {
    const btn = document.createElement("button");
    btn.className = "chord-toggle" + (selectedChords.includes(name) ? " selected" : "");
    btn.textContent = name;
    btn.onclick = () => onToggle(name, btn);
    grid.appendChild(btn);
  });
}
