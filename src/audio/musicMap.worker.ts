/// <reference lib="webworker" />
import Essentia from 'essentia.js/dist/essentia.js-core.es.js';
import { EssentiaWASM } from 'essentia.js/dist/essentia-wasm.es.js';
import {
  sectionsFromEnergy,
  type EnergyWindow,
  type SerializedMusicMap,
} from './sectionFromAnalysis';
import type { ExtractRequest, ExtractResponse } from './extractProtocol';

/**
 * Web Worker: decode uploaded audio off the main thread, run
 * essentia.js RhythmExtractor2013 (degara — faster on Quest Chromium),
 * then label sections from an RMS envelope. Posts a SerializedMusicMap.
 *
 * Main thread never decodes audio (CLAUDE.md). WASM is lazy-loaded
 * with this worker, not the entry bundle.
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

self.onmessage = async (event: MessageEvent<ExtractRequest>) => {
  try {
    const { buffer, name } = event.data;
    const ctx = new OfflineAudioContext(1, 1, 44100);
    const audio = await ctx.decodeAudioData(buffer);
    const ess = getEssentia();
    const mono = ess.audioBufferToMonoSignal(audio);
    const vector = ess.arrayToVector(mono);
    const rhythm = ess.RhythmExtractor2013(vector, 208, 'degara', 40);
    const map: SerializedMusicMap = {
      trackId: name,
      durationSec: audio.duration,
      bpm: Number(rhythm.bpm) || 0,
      beats: asNumbers(rhythm.ticks, ess),
      sections: sectionsFromEnergy(audio.duration, rmsWindows(mono, audio.sampleRate)),
    };
    const response: ExtractResponse = { ok: true, map };
    self.postMessage(response);
  } catch (err) {
    const response: ExtractResponse = { ok: false, error: String(err) };
    self.postMessage(response);
  }
};
