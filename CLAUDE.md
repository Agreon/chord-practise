# Guitar Chord Practice App

## Project Structure
Vanilla JS ES module app — no framework, no build step. Requires a local server (not `file://`).

```
guitar/
├── index.html      # Static HTML shell
├── styles.css      # All styles
└── js/
    ├── data.js     # CHORDS + CHORD_NOTES constants
    ├── timer.js    # Reaction timer ring, speed scoring, combinedScore
    ├── audio.js    # Mic setup, chromagram chord detection, volume bars
    ├── storage.js  # saveProgress/loadProgress via window.storage, showSaveIndicator
    ├── ui.js       # drawChord SVG, showChordCard, updateStats, buildChordSelect
    ├── session.js  # App state (state object), pickChord, handleRating, nextChord, autoAdvance
    └── main.js     # Boot (top-level await) + event listeners
```

## Key Patterns
- **State**: single `state` object exported from `session.js` (const object, mutable properties)
- **Circular dep fix**: `audio.js` fires detection via `setDetectionCallback(fn)` — registered in `main.js`
- **Storage**: `window.storage.get/set` (custom API, not localStorage)
- **Serving**: use VS Code Live Server or `python3 -m http.server 8080`