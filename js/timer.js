export const MAX_REACTION_TIME = 8000; // 8s = "slow"
export const FAST_THRESHOLD = 2000;    // under 2s = fast
export const MEDIUM_THRESHOLD = 5000;  // under 5s = medium
export const CIRCUMFERENCE = 2 * Math.PI * 38; // matches r=38 in SVG

let chordShownAt = null;
let reactionMs = null;
let timerAnimFrame = null;

export function getReactionMs() { return reactionMs; }
export function cancelTimerAnimation() { cancelAnimationFrame(timerAnimFrame); }

export function startReactionTimer() {
  chordShownAt = performance.now();
  reactionMs = null;
  updateTimerUI(0);
  cancelAnimationFrame(timerAnimFrame);
  animateTimer();
}

export function stopReactionTimer() {
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

export function getSpeedClass(ms) {
  if (ms <= FAST_THRESHOLD) return "fast";
  if (ms <= MEDIUM_THRESHOLD) return "medium";
  return "slow";
}

export function updateTimerUI(ms) {
  const arc = document.getElementById("timer-arc");
  const secEl = document.getElementById("timer-seconds");
  if (!arc || !secEl) return;

  const capped = Math.min(ms, MAX_REACTION_TIME);
  const frac = capped / MAX_REACTION_TIME;
  arc.style.strokeDashoffset = CIRCUMFERENCE * frac;

  const sClass = getSpeedClass(ms);
  arc.setAttribute("class", "timer-arc " + sClass);
  secEl.className = "timer-seconds " + sClass;
  secEl.textContent = (ms / 1000).toFixed(1);
}

export function reactionScore(ms) {
  if (ms === null) return 0;
  if (ms <= FAST_THRESHOLD) return 1;
  if (ms >= MAX_REACTION_TIME) return 0;
  return 1 - (ms - FAST_THRESHOLD) / (MAX_REACTION_TIME - FAST_THRESHOLD);
}

// Correctness weighted 60%, speed 40%
export function combinedScore(correctnessScore, ms) {
  if (correctnessScore === 0) return 0;
  return correctnessScore * 0.6 + reactionScore(ms) * 0.4 * correctnessScore;
}
