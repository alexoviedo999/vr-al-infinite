import { create } from 'zustand';

/**
 * Live tuning knobs for the rail prototype. The DebugPanel writes here;
 * RailMover, RailPrototype, and TunnelAlongSpline read from
 * getState() inside per-frame callbacks (no per-frame setState).
 *
 * Defaults match the authored feel: slow enough to aim, fog rolls in
 * around the next landmark, three rings spaced for a steady rhythm.
 */
interface TuningState {
  speed: number;
  fogNear: number;
  fogFar: number;
  ringAnchorTs: [number, number, number];
  firstOrbAnchorT: number;
  setSpeed: (v: number) => void;
  setFogNear: (v: number) => void;
  setFogFar: (v: number) => void;
  setRingAnchorT: (index: 0 | 1 | 2, v: number) => void;
  setFirstOrbAnchorT: (v: number) => void;
}

export const useTuningStore = create<TuningState>((set) => ({
  speed: 2.5,
  fogNear: 6,
  fogFar: 30,
  ringAnchorTs: [0.5, 0.8, 0.95],
  firstOrbAnchorT: 0.7,
  setSpeed: (v) => set({ speed: v }),
  setFogNear: (v) => set({ fogNear: v }),
  setFogFar: (v) => set({ fogFar: v }),
  setRingAnchorT: (index, v) =>
    set((s) => {
      const next = [...s.ringAnchorTs] as [number, number, number];
      next[index] = v;
      return { ringAnchorTs: next };
    }),
  setFirstOrbAnchorT: (v) => set({ firstOrbAnchorT: v }),
}));