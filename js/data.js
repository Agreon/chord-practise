// Format: strings from low E to high e (0=open, -1=muted, 1-12=fret)
// barre: { fret, from, to } optional
export const CHORDS = {
  C:     { type: "Major",        fingers: [-1, 3, 2, 0, 1, 0], barre: null },
  D:     { type: "Major",        fingers: [-1, -1, 0, 2, 3, 2], barre: null },
  E:     { type: "Major",        fingers: [0, 2, 2, 1, 0, 0], barre: null },
  G:     { type: "Major",        fingers: [3, 2, 0, 0, 0, 3], barre: null },
  A:     { type: "Major",        fingers: [-1, 0, 2, 2, 2, 0], barre: null },
  Am:    { type: "Minor",        fingers: [-1, 0, 2, 2, 1, 0], barre: null },
  Em:    { type: "Minor",        fingers: [0, 2, 2, 0, 0, 0], barre: null },
  Dm:    { type: "Minor",        fingers: [-1, -1, 0, 2, 3, 1], barre: null },
  F:     { type: "Major",        fingers: [1, 1, 2, 3, 3, 1], barre: { fret: 1, from: 0, to: 5 } },
  Bm:    { type: "Minor",        fingers: [-1, 2, 4, 4, 3, 2], barre: { fret: 2, from: 1, to: 5 } },
  C7:    { type: "Dominant 7",   fingers: [-1, 3, 2, 3, 1, 0], barre: null },
  G7:    { type: "Dominant 7",   fingers: [3, 2, 0, 0, 0, 1], barre: null },
  D7:    { type: "Dominant 7",   fingers: [-1, -1, 0, 2, 1, 2], barre: null },
  A7:    { type: "Dominant 7",   fingers: [-1, 0, 2, 0, 2, 0], barre: null },
  E7:    { type: "Dominant 7",   fingers: [0, 2, 2, 1, 3, 0], barre: null },
  Cadd9: { type: "Add 9",        fingers: [-1, 3, 2, 0, 3, 0], barre: null },
};

// Pitch classes: 0=C, 1=C#, ..., 11=B
export const CHORD_NOTES = {
  C:     [0, 4, 7],
  D:     [2, 6, 9],
  E:     [4, 8, 11],
  G:     [7, 11, 2],
  A:     [9, 1, 4],
  Am:    [9, 0, 4],
  Em:    [4, 7, 11],
  Dm:    [2, 5, 9],
  F:     [5, 9, 0],
  Bm:    [11, 2, 6],
  C7:    [0, 4, 7, 10],
  G7:    [7, 11, 2, 5],
  D7:    [2, 6, 9, 0],
  A7:    [9, 1, 4, 7],
  E7:    [4, 8, 11, 2],
  Cadd9: [0, 4, 7, 2],
};
