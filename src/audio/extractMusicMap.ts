import { decodeAiff } from './decodeAiff';
import type { SerializedMusicMap } from './sectionFromAnalysis';
import type { ExtractRequest, ExtractResponse } from './extractProtocol';

/**
 * Decode on the main thread *during upload only* (OfflineAudioContext
 * is not defined in dedicated workers), then transfer mono PCM to the
 * essentia worker. The 90 Hz loop never touches decode.
 */
async function decodeMono(buffer: ArrayBuffer): Promise<{
  samples: Float32Array;
  sampleRate: number;
  durationSec: number;
}> {
  try {
    const ctx = new AudioContext();
    try {
      const audio = await ctx.decodeAudioData(buffer.slice(0));
      return {
        samples: mixMono(audio),
        sampleRate: audio.sampleRate,
        durationSec: audio.duration,
      };
    } finally {
      void ctx.close();
    }
  } catch {
    return decodeAiff(buffer);
  }
}

function mixMono(audio: AudioBuffer): Float32Array {
  if (audio.numberOfChannels === 1) return Float32Array.from(audio.getChannelData(0));
  const left = audio.getChannelData(0);
  const right = audio.numberOfChannels > 1 ? audio.getChannelData(1) : left;
  const out = new Float32Array(left.length);
  for (let i = 0; i < left.length; i++) out[i] = (left[i] + right[i]) * 0.5;
  return out;
}

export async function extractMusicMap(
  buffer: ArrayBuffer,
  name: string,
): Promise<SerializedMusicMap> {
  const decoded = await decodeMono(buffer);
  const maxSamples = Math.floor(decoded.sampleRate * 90);
  if (decoded.samples.length > maxSamples) {
    decoded.samples = decoded.samples.slice(0, maxSamples);
    decoded.durationSec = decoded.samples.length / decoded.sampleRate;
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./musicMap.worker.ts', import.meta.url), {
      type: 'module',
    });
    const fail = (error: string) => {
      worker.terminate();
      reject(new Error(error));
    };
    worker.onmessage = (event: MessageEvent<ExtractResponse>) => {
      worker.terminate();
      if (event.data.ok) resolve(event.data.map);
      else fail(event.data.error);
    };
    worker.onerror = (event) => fail(event.message || 'Music Map worker failed');
    const request: ExtractRequest = { ...decoded, name };
    worker.postMessage(request, [decoded.samples.buffer]);
  });
}
