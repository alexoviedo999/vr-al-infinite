/**
 * Diatonic Chime voicing. Cascade size = chord size (1 = tonic,
 * 3 = triad, 4 = seventh, …). Notes are scale degrees 1-3-5-7-9,
 * not a pentatonic ladder. The player's voice stays in-key.
 */

export type ScaleMode = 'major' | 'minor';

export interface MusicalKey {
  tonicPc: number;
  mode: ScaleMode;
}

export const DEFAULT_KEY: MusicalKey = { tonicPc: 9, mode: 'minor' }; // A minor

const TONIC_PC: Record<string, number> = {
  C: 0,
  'C#': 1,
  DB: 1,
  D: 2,
  'D#': 3,
  EB: 3,
  E: 4,
  F: 5,
  'F#': 6,
  GB: 6,
  G: 7,
  'G#': 8,
  AB: 8,
  A: 9,
  'A#': 10,
  BB: 10,
  B: 11,
};

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10]; // natural minor
/** Scale-degree indices for stacked chord tones: 1, 3, 5, 7, 9, 11, 13, then +8ve. */
const CHORD_DEGREES = [0, 2, 4, 6, 8, 10, 12, 14];

const PC_NAME = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function formatKey(key: MusicalKey): string {
  return `${PC_NAME[key.tonicPc] ?? 'A'} ${key.mode}`;
}

export function parseKey(tonic: string, mode: string): MusicalKey {
  const pc = TONIC_PC[tonic.trim().toUpperCase()];
  if (pc === undefined) return { ...DEFAULT_KEY };
  const m = mode.toLowerCase().includes('min') ? 'minor' : 'major';
  return { tonicPc: pc, mode: m };
}

/** Tonic MIDI in a mid register (about C3–G4). C→60, A→57. */
export function rootMidi(tonicPc: number): number {
  let midi = 48 + tonicPc;
  if (midi < 55) midi += 12;
  if (midi > 67) midi -= 12;
  return midi;
}

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function cascadeChordMidi(n: number, key: MusicalKey): number[] {
  if (n <= 0) return [];
  const scale = key.mode === 'major' ? MAJOR : MINOR;
  const root = rootMidi(key.tonicPc);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const deg = CHORD_DEGREES[i % CHORD_DEGREES.length];
    const wrapOct = Math.floor(i / CHORD_DEGREES.length);
    const scaleIdx = deg % 7;
    const scaleOct = Math.floor(deg / 7);
    out.push(root + scale[scaleIdx] + 12 * (scaleOct + wrapOct));
  }
  return out;
}

export function cascadeChordHz(n: number, key: MusicalKey): number[] {
  return cascadeChordMidi(n, key).map(midiToHz);
}
