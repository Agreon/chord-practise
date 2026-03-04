import { CHORDS } from "./data.js";
import { setupMic, setDetectionCallback, setupVolumeBars, cancelVolumeAnimation } from "./audio.js";
import { cancelTimerAnimation } from "./timer.js";
import { loadProgress, saveProgress } from "./storage.js";
import { buildChordSelect } from "./ui.js";
import {
  state,
  applyLoadedData,
  initScores,
  nextChord,
  resetProgress,
  stopSession,
  syncDelaySlider,
  toggleChord,
  onChordDetected,
} from "./session.js";

// Break the audio ↔ session circular dependency
setDetectionCallback(onChordDetected);

// ─── Boot ─────────────────────────────────────────────────────────────────────
const data = await loadProgress();
if (data) applyLoadedData(data);
initScores();
buildChordSelect(state.selectedChords, Object.keys(CHORDS), toggleChord);
setupVolumeBars();
syncDelaySlider();

if (data) {
  const status = document.getElementById("mic-status");
  status.textContent = "✓ Progress loaded from last session";
  status.className = "mic-status ok";
  buildChordSelect(state.selectedChords, Object.keys(CHORDS), toggleChord);
}

await setupMic();

// ─── Event Listeners ──────────────────────────────────────────────────────────
document.getElementById("start-btn").onclick = () => {
  document.getElementById("setup-screen").style.display = "none";
  document.getElementById("practice-screen").style.display = "block";
  nextChord();
};

document.getElementById("skip-btn").onclick = () => {
  cancelVolumeAnimation();
  cancelTimerAnimation();
  nextChord();
};

document.getElementById("settings-btn").onclick = stopSession;
document.getElementById("end-btn").onclick = stopSession;
document.getElementById("reset-btn").onclick = resetProgress;

document.getElementById("advance-delay-slider").oninput = (e) => {
  state.autoAdvanceDelay = Number.parseFloat(e.target.value) * 1000;
  document.getElementById("advance-delay-value").textContent =
    Number.parseFloat(e.target.value).toFixed(1) + "s";
  const { mastery, attempts, selectedChords, bestTimes, autoAdvanceDelay } = state;
  saveProgress({ mastery, attempts, selectedChords, bestTimes, autoAdvanceDelay });
};
