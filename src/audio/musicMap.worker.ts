/// <reference lib="webworker" />
import Essentia from 'essentia.js/dist/essentia.js-core.es.js';
import { EssentiaWASM } from 'essentia.js/dist/essentia-wasm.es.js';
import {
  sectionsFromEnergy,
  type EnergyWindow,
  type SerializedKey,
  type SerializedMusicMap,
} from './sectionFromAnalysis';
import type { ExtractRequest, ExtractResponse } from './extractProtocol';

/**
 * Web Worker: run essentia.js RhythmExtractor2013 (degara) on
 * already-decoded mono PCM, then label sections from an RMS envelope.
 * WASM is lazy-loaded with this worker, not the entry bundle.
 *
 * Decode happens on the main thread at upload time only —
 * OfflineAudioContext is not available in dedicated workers.
 */

let essentia: InstanceType<typeof Essentia> | null = null;

function getEssentia(): InstanceType<typeof Essentia> {
  if (!essentia) essentia = new Essentia(EssentiaWASM);
  return essentia;
}

function asNumbers(value: unknown, ess: InstanceType<typeof Essentia>): number[] {
  if (!value) return [];
  if (value instanceof Float32Array) return Array.from(value);
  if (Array.isArray(value)) return value.map(Number);
  try {
    return Array.from(ess.vectorToArray(value));
  } catch {
    return [];
  }
}

function extractKey(
  ess: InstanceType<typeof Essentia>,
  vector: unknown,
  sampleRate: number,
): SerializedKey {
  try {
    const result = ess.KeyExtractor(
      vector,
      true,
      4096,
      4096,
      12,
      3500,
      60,
      25,
      0.2,
      'bgate',
      sampleRate,
    );
    const tonic = String(result.key ?? 'A');
    const mode = String(result.scale ?? '').toLowerCase().includes('min')
      ? 'minor'
      : 'major';
    return { tonic, mode };
  } catch {
    return { tonic: 'A', mode: 'minor' };
  }
}

function rmsWindows(mono: Float32Array, sampleRate: number): EnergyWindow[] {
  const hop = Math.max(1, Math.floor(sampleRate * 0.5));
  const out: EnergyWindow[] = [];
  for (let i = 0; i + hop <= mono.length; i += hop) {
    let acc = 0;
    for (let j = 0; j < hop; j++) acc += mono[i + j] * mono[i + j];
    out.push({ startSec: i / sampleRate, rms: Math.sqrt(acc / hop) });
  }
  return out;
}

self.onmessage = (event: MessageEvent<ExtractRequest>) => {
  try {
    const { samples, sampleRate, durationSec, name } = event.data;
    const ess = getEssentia();
    const rhythmVec = ess.arrayToVector(samples);
    const rhythm = ess.RhythmExtractor2013(rhythmVec, 208, 'degara', 40);
    const keyVec = ess.arrayToVector(samples);
    const key = extractKey(ess, keyVec, sampleRate);
    const map: SerializedMusicMap = {
      trackId: name,
      durationSec,
      bpm: Number(rhythm.bpm) || 0,
      beats: asNumbers(rhythm.ticks, ess),
      key,
      sections: sectionsFromEnergy(durationSec, rmsWindows(samples, sampleRate)),
    };
    const response: ExtractResponse = { ok: true, map };
    self.postMessage(response);
  } catch (err) {
    const response: ExtractResponse = { ok: false, error: String(err) };
    self.postMessage(response);
  }
};
