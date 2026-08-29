/**
 * One pitched Chime. Frequency comes from the diatonic cascade chord
 * (`chimeScale.ts`); scheduling/quantization lives in CascadeChimes.
 */

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function playChime(frequencyHz: number, whenSec = 0): void {
  if (!(frequencyHz > 0)) return;
  const ac = audioCtx();
  if (ac.state === 'suspended') void ac.resume();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequencyHz;
  const t = ac.currentTime + whenSec;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.11, t + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.45);
}
