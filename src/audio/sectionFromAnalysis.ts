import type { SectionName } from '../rail/musicMap';

/**
 * Pure Music Map construction from a beat grid + energy envelope.
 * The worker runs essentia.js (RhythmExtractor2013) and posts RMS
 * windows here so section labelling stays unit-testable without WASM.
 *
 * Section names and velocity multipliers match CONTEXT.md / MockMusicMap:
 * intro slow, drop fastest, breakdown medium. Curvature stays [0,0,0]
 * until a later ticket maps audio into the spline (Catmull-Rom jerks
 * at any extra knot — see MockMusicMap).
 */

export const SECTION_VELOCITY: Record<SectionName, number> = {
  intro: 0.6,
  build: 1.1,
  drop: 1.4,
  breakdown: 0.8,
  outro: 0.7,
};

export interface EnergyWindow {
  startSec: number;
  rms: number;
}

export interface SerializedSection {
  name: SectionName;
  startT: number;
  velocity: number;
  curvature: [number, number, number];
}

export interface SerializedMusicMap {
  trackId: string;
  durationSec: number;
  bpm: number;
  beats: number[];
  sections: SerializedSection[];
}

const FALLBACK: SerializedSection[] = [
  section('intro', 0.1),
  section('drop', 0.55),
  section('breakdown', 0.8),
];

function section(name: SectionName, startT: number): SerializedSection {
  return {
    name,
    startT,
    velocity: SECTION_VELOCITY[name],
    curvature: [0, 0, 0],
  };
}

/**
 * Turn a coarse RMS envelope into ordered SectionBoundary-shaped
 * records. Loudest window → drop; a quieter lead-in → intro/build;
 * a quieter tail → breakdown/outro. startT is duration-normalised.
 */
export function sectionsFromEnergy(
  durationSec: number,
  windows: readonly EnergyWindow[],
): SerializedSection[] {
  if (!(durationSec > 0) || windows.length === 0) return FALLBACK.map((s) => ({ ...s }));

  let peak = windows[0];
  for (const w of windows) {
    if (w.rms > peak.rms) peak = w;
  }
  const dropT = clamp01(peak.startSec / durationSec);
  const last = windows[windows.length - 1];
  const lastT = clamp01(last.startSec / durationSec);

  const drafted: SerializedSection[] = [section('intro', Math.min(0.08, Math.max(0.02, dropT * 0.15)))];

  if (dropT > drafted[0].startT + 0.12) {
    drafted.push(section('build', (drafted[0].startT + dropT) / 2));
  }
  drafted.push(section('drop', Math.max(drafted[drafted.length - 1].startT + 0.05, dropT)));

  if (lastT > drafted[drafted.length - 1].startT + 0.1 && last.rms < peak.rms * 0.7) {
    drafted.push(
      section(
        'breakdown',
        Math.min(0.92, (drafted[drafted.length - 1].startT + lastT) / 2),
      ),
    );
  }
  if (lastT > 0.85 && last.rms < peak.rms * 0.5) {
    drafted.push(section('outro', Math.min(0.94, Math.max(lastT, drafted[drafted.length - 1].startT + 0.04))));
  }

  return dedupeIncreasing(drafted);
}

function clamp01(t: number): number {
  return Math.min(0.97, Math.max(0.02, t));
}

function dedupeIncreasing(sections: SerializedSection[]): SerializedSection[] {
  const out: SerializedSection[] = [];
  for (const s of sections) {
    const t = clamp01(s.startT);
    if (out.length === 0 || t > out[out.length - 1].startT + 0.02) {
      out.push({ ...s, startT: t });
    }
  }
  return out.length > 0 ? out : FALLBACK.map((s) => ({ ...s }));
}

/** A minor pentatonic, A3 upward. Cascade index 0 is the oldest lock. */
const CHIME_HZ = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33];

export function chimeFrequency(cascadeIndex: number): number {
  return CHIME_HZ[((cascadeIndex % CHIME_HZ.length) + CHIME_HZ.length) % CHIME_HZ.length];
}
