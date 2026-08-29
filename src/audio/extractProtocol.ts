import type { SerializedMusicMap } from './sectionFromAnalysis';

export interface ExtractRequest {
  /** Mono PCM. Transferred to the worker; do not reuse after postMessage. */
  samples: Float32Array;
  sampleRate: number;
  durationSec: number;
  name: string;
}

export type ExtractResponse =
  | { ok: true; map: SerializedMusicMap }
  | { ok: false; error: string };
