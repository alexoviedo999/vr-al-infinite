import { chimeFrequency } from './sectionFromAnalysis';

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/**
 * Placeholder Chime: a short pentatonic beep. CascadeChimes quantizes
 * `whenSec` onto the active Music Map Beat Grid. Synthesis, not decode.
 */
export function playChime(cascadeIndex: number, whenSec = 0): void {
  const ac = audioCtx();
  if (ac.state === 'suspended') void ac.resume();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = chimeFrequency(cascadeIndex);
  const t = ac.currentTime + whenSec;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.3);
}
