# Audio analysis library — research note

Resolves [#4](https://github.com/alexoviedo999/vr-al-infinite/issues/4): which library should extract a Music Map (beat grid + section boundaries) from a user-uploaded audio file in a browser Web Worker.

**Decision: essentia.js.** Meyda cannot produce a Music Map (no BPM, no beat tracking, no onset detection — only spectral flux, a single ingredient). A custom Web Audio API pipeline would re-invent essentia.js's beat tracker in worker-unfriendly JavaScript. essentia.js' WASM backend runs the same C++ algorithms the Vortexr demo track's Music Maps were generated with offline.

## Why essentia.js, on each axis

1. **Library choice.** essentia.js exposes `RhythmExtractor2013`, `BeatTrackerMultiFeature`, `BpmHistogramDescriptors`, `TempoTap`, `OnsetRate`, `OnsetDetection`, `NoveltyCurve`, `MFCC`, `SpectralContrast`, `Loudness` — i.e. every primitive the Music Map needs ([EssentiaExtractor API](https://mtg.github.io/essentia.js/docs/api/EssentiaExtractor.html)). Meyda's [audio-features list](https://meyda.js.org/audio-features) is RMS/ZCR/centroid/flatness/rolloff/spread/skewness/kurtosis/crest/flux/slope/chroma/loudness/MFCC/perceptual — useful as a React layer feed, but it does **not** ship BPM, beat tracking, or a dedicated onset detector. Custom Web Audio only gives you an `AnalyserNode` and FFT bins; you would still need to hand-write a beat tracker (typically a comb-filter bank on an onset detection function) and a structure segmenter.
2. **Worker-friendliness.** essentia.js' WASM build is designed to load inside a Web Worker; the TISMIR 2021 paper states non-realtime model inference uses Web Workers, and the synchronous-import WASM build integrates with both AudioWorklets and Workers ([Correya et al., 2021 §3](https://transactions.ismir.net/articles/10.5334/tismir.111)). Meyda also works in a worker but the audio features it ships are too low-level for the job. Web Audio AnalyserNode is **main-thread only** — you cannot construct one inside a Worker.
3. **Beat detection on electronic / deep-house / techno.** essentia.js' `RhythmExtractor2013` and `BeatTrackerMultiFeature` are the algorithms Essen­tia's [tempo/beat-detector blog](https://essentia.upf.edu/blog/bpm-detection-accuracy-different-genres-essentia-javascript-models.html) evaluates across genres, and they are specifically tuned against percussive, tempo-stable music. Meyda has no beat tracker at all.
4. **Section detection.** essentia.js exposes `NoveltyCurve` (Grosche & Müller, 2009 — log-compressed energy derivatives, sum of weighted bands), which is the standard self-similarity/novelty curve for finding intro/build/drop/breakdown boundaries ([NoveltyCurve ref](https://essentia.upf.edu/reference/std_NoveltyCurve.html)). You still cluster peaks yourself, but the curve extraction is the hard part and essentia gives it to you. Meyda has no novelty-curve or segmentation primitive.
5. **Static-deploy compatibility.** essentia.js is a pure static asset (WASM + JS + TF.js model files), no server-side dependency, no CORS gotchas beyond setting COOP/COEP headers if you want `SharedArrayBuffer` — not required here because we are not sharing buffers with the main thread, only posting results. Same for Meyda. Custom Web Audio also static, but suffers from issue (2).
6. **Latency on Quest 3 browser worker.** Per the TISMIR 2021 paper, most essentia.js algorithms finish a 30-second clip in 0.46–3.48 s on a 2021 XPS-15 (1.5–6.8% of audio duration); MFCC is worst at 8.68 s (28.9%), pYIN at 16.4 s. Tempo + onset + novelty on a 3-minute (180 s) clip is dominated by spectral front-ends (windowing, FFT), so a Quest 3 browser worker should land in the **~5–15 s range** for the full Music Map. **Important caveat:** the same paper reports Chrome on Android is the *slowest* platform tested — Quest 3's Chromium runtime is a mobile-class engine, so expect 2–3× the desktop timings. A 3-minute deep-house track should still finish well under the audio length (faster than realtime). Meyda would be faster (pure JS FFT), but it cannot do the job.

## Bundle-size impact

- **essentia.js core WASM backend + JS API: ~2.5 MB** (~3 MB with add-ons). Custom builds via `essentia.js` CLI can strip to only the algorithms we use ([TISMIR 2021 §4.1](https://transactions.ismir.net/articles/10.5334/tismir.111)). Recommended initial install: `essentia.js` (full) plus `essentia.js-models` (if/when we want TempoCNN or genre classification). TempoCNN itself is only 0.1 MB / 27K params.
- Meyda is much smaller (~30 KB minified), but irrelevant — it cannot produce the data structure vr-al-infinite needs.

The 2.5 MB WASM is loaded **lazily on the upload screen**, not on the entry bundle, so it does not bloat the first load of the experience.

## Minimal pipeline (3-minute AIFF → Music Map in a Web Worker)

```js
// audio-analysis.worker.ts  (run in a dedicated Web Worker)
import { EssentiaWASM } from 'essentia.js/dist/essentia-wasm.es.js';
import Essentia from 'essentia.js/dist/essentia.es.js';

const essentia = new Essentia(EssentiaWASM);

async function decodeAiff(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  // OfflineAudioContext.decodeAudioData handles AIFF/WAV/MP3/OGG/FLAC
  // (browser-dependent for FLAC; AIFF is universal).
  const ctx = new OfflineAudioContext(1, 44100, 44100);
  return await ctx.decodeAudioData(arrayBuffer);
}

function toMonoFloat32(buf: AudioBuffer): Float32Array {
  if (buf.numberOfChannels === 1) return buf.getChannelData(0);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const out = new Float32Array(L.length);
  for (let i = 0; i < L.length; i++) out[i] = (L[i] + R[i]) * 0.5;
  return out;
}

async function extractMusicMap(arrayBuffer: ArrayBuffer) {
  const audioBuffer = await decodeAiff(arrayBuffer);
  const mono = toMonoFloat32(audioBuffer);

  // 1. BPM + beat ticks (RhythmExtractor2013)
  const rhythm = essentia.RhythmExtractor2013(
    mono,
    audioBuffer.sampleRate,
  );
  const bpm: number = rhythm.bpm;
  const ticks: number[] = rhythm.ticks; // seconds, including downbeat

  // 2. Novelty curve → pick peaks → sections
  const frameSize = 2048, hopSize = 1024;
  const frames = essentia.FrameGenerator(
    mono, frameSize, hopSize, /*startTime*/ 0,
  );
  const spectrum = essentia.Spectrum(frames, frameSize);
  const novelty  = essentia.NoveltyCurve(spectrum, /*weightCurve*/ undefined);

  const peakTimesSec: number[] = peaksAboveThreshold(novelty, 0.35);
  const sections: { name: string; startTime: number; endTime: number }[] =
    clusterPeaksToSections(peakTimesSec, audioBuffer.duration);

  return {
    trackId: 'uploaded',
    durationSec: audioBuffer.duration,
    bpm,
    downbeatTime: ticks[0],
    beatsPerBar: 4,            // vr-al-infinite's chosen fixed meter for now
    beats: ticks,
    sections,
  };
}

self.onmessage = async (e: MessageEvent<ArrayBuffer>) => {
  try {
    const map = await extractMusicMap(e.data);
    (self as any).postMessage({ ok: true, map });
  } catch (err) {
    (self as any).postMessage({ ok: false, error: String(err) });
  }
};

// `peaksAboveThreshold` and `clusterPeaksToSections` are tiny helpers:
//   - peaksAboveThreshold: simple local-max picker on the novelty array
//     (or use essentia.PredominantPitchMelodia-style peak picking on
//     (novelty - median) > k*std).
//   - clusterPeaksToSections: group nearby peaks, label them by energy
//     (loudness → "build" / "drop" / "breakdown") and produce
//     [{startTime, endTime, name}] sorted, non-overlapping.
```

The output shape matches Vortexr's `MusicMap` interface verbatim (`src/music/MusicMap.ts`), so the consumer code in vr-al-infinite can be lifted directly.

## Caveats / known issues on Quest 3 browser

- **First WASM compile is slow.** Emscripten Wasm instantiation on Quest's Chromium can take 1–3 s. Show a "Analysing track…" progress indicator and warm the worker on the upload screen, not after the user clicks Start.
- **Memory.** essentia.js processing a 3-minute stereo AIFF decodes to ~30 MB of `Float32Array` data. Quest 3 has 8 GB RAM so this is safe; older Quest devices (4 GB) would need streaming or chunked decode.
- **AIFF support.** All Chromium-based browsers decode AIFF via `decodeAudioData`. If we later add FLAC, Safari-only or older Android users may need a Polyfill — not relevant for Quest 3.
- **Real-time factor on Quest.** Per the TISMIR benchmarks, Chrome-on-Android is the slowest target. Budget **2–3× the desktop timings** on Quest's Chromium. For a 180 s track, expect ~10–30 s end-to-end. If too slow, swap `RhythmExtractor2013` for the smaller `BeatTrackerDegara` (~5× faster) and use a fixed-radius novelty peak picker.
- **Quest browser = Chromium with mobile Vulkan**. No WebGPU by default — fine, essentia.js uses the WASM backend (no GPU model inference in the hot path; we are not running TempoCNN for beat detection, we are running `RhythmExtractor2013`).
- **Music Map is fixed once extracted.** The viz / Music Map-driven gameplay code only needs to read the JSON — no runtime analysis happens during a Run.

## Sources

- [EssentiaExtractor API](https://mtg.github.io/essentia.js/docs/api/EssentiaExtractor.html)
- [Correya et al., TISMIR 2021 — Audio and Music Analysis on the Web using Essentia.js](https://transactions.ismir.net/articles/10.5334/tismir.111) (bundle size, algorithm counts, performance numbers, Web Worker / AudioWorklet story)
- [essentia.js BPM detection across genres blog post](https://essentia.upf.edu/blog/bpm-detection-accuracy-different-genres-essentia-javascript-models.html)
- [NoveltyCurve reference](https://essentia.upf.edu/reference/std_NoveltyCurve.html)
- [Meyda audio-features list](https://meyda.js.org/audio-features)
- Vortexr `src/music/MusicMap.ts` and `src/music/useMusicMap.ts` (target output shape)
