import type { SerializedMusicMap } from './sectionFromAnalysis';

export interface ExtractRequest {
  buffer: ArrayBuffer;
  name: string;
}

export type ExtractResponse =
  | { ok: true; map: SerializedMusicMap }
  | { ok: false; error: string };
