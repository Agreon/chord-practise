# Chord Practice

An adaptive guitar training app that listens to your playing and focuses practice on the chords you find hardest.

## How it works

1. Pick the chords you want to practice
2. The app shows a chord diagram and listens via your microphone
3. Strum — it detects the chord and starts a reaction timer
4. Harder chords appear more often; mastery is tracked across sessions

## Features

- Mic-based chord detection using chromagram analysis
- Reaction time scoring with a visual timer ring
- Adaptive spaced repetition — poor ratings increase a chord's frequency
- Per-chord mastery bars that persist across sessions

## Running locally

Requires a local server (ES modules don't work over `file://`):

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

Or use the VS Code Live Server extension.
