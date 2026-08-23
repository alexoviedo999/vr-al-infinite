import { create } from 'zustand';
import type { WebGLRenderer } from 'three';

/**
 * Global runtime state for vr-al-infinite. Intentionally tiny for the
 * bootstrap scaffold — this is where Run / Track / Music Map state will
 * live once those tickets land. Per the Quest 3 perf note in
 * `docs/research/quest3-webxr-perf.md`: per-frame mutation MUST NOT
 * trigger setState; per-frame data lives in refs (see e.g. FFT buffer).
 * Zustand is reserved for rare UI events (track loaded, run started/ended).
 */
type RunState = 'idle' | 'loading' | 'ready' | 'running' | 'ended';

export interface AppState {
  runState: RunState;
  trackTitle: string | null;
  /**
   * Three.js renderer captured by the Canvas via `onCreated`. Lifts the
   * WebXR-aware renderer out of the R3F tree so DOM overlays (e.g. the
   * Enter VR button) can drive `gl.xr.setSession()` without themselves
   * living inside the Canvas. Set once on mount; never reassigned.
   */
  xrRenderer: WebGLRenderer | null;
  setTrack: (title: string) => void;
  setRunState: (state: RunState) => void;
  setXrRenderer: (renderer: WebGLRenderer) => void;
}

export const useAppStore = create<AppState>((set) => ({
  runState: 'idle',
  trackTitle: null,
  xrRenderer: null,
  setTrack: (title) => set({ trackTitle: title, runState: 'ready' }),
  setRunState: (runState) => set({ runState }),
  setXrRenderer: (renderer) => set({ xrRenderer: renderer }),
}));
