declare module 'essentia.js/dist/essentia.js-core.es.js' {
  export default class Essentia {
    constructor(wasm: unknown);
    arrayToVector(input: Float32Array): unknown;
    vectorToArray(v: unknown): Float32Array;
    audioBufferToMonoSignal(buffer: AudioBuffer): Float32Array;
    RhythmExtractor2013(
      signal: unknown,
      maxTempo?: number,
      method?: string,
      minTempo?: number,
    ): { bpm: number; ticks: unknown };
  }
}

declare module 'essentia.js/dist/essentia-wasm.es.js' {
  export const EssentiaWASM: unknown;
}
