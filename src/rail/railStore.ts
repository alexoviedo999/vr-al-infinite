import { create } from 'zustand';
import * as THREE from 'three';
import { arcLength, TOTAL_ARC_LENGTH } from './spline';

/**
 * Rail runtime state for ticket #9. Splits into two layers:
 *
 * - Sparse Zustand state (`runState`) for UI events (start/end). Updated
 *   rarely; consumers re-render only when it changes.
 * - Per-frame mutable refs (`playerTRef`, `playerPosRef`, `tangentRef`)
 *   for the camera pose. Per the Quest 3 perf note, per-frame mutation
 *   MUST NOT trigger setState — these refs are written by RailMover's
 *   useFrame and read by AimTracker, TunnelAlongSpline, etc.
 *
 * Speed is exposed through `getSpeed(t)` (currently constant). #12
 * drops in a section-driven velocity profile via this same seam.
 */

export const RAIL_SPEED = 6;

export type RunState = 'idle' | 'running' | 'ended';

interface RailState {
  runState: RunState;
  start: () => void;
  end: () => void;
}

export const useRailStore = create<RailState>((set) => ({
  runState: 'idle',
  start: () => set({ runState: 'running' }),
  end: () => set({ runState: 'ended' }),
}));

// Per-frame mutable refs. Exported as plain objects so consumers can
// access them inside their own useFrame (refs are not tracked by React;
// reading them in render would yield stale values).
export const playerTRef: { current: number } = { current: 0 };
export const playerPosRef: { current: THREE.Vector3 } = { current: new THREE.Vector3(0, 0, 0) };
export const tangentRef: { current: THREE.Vector3 } = { current: new THREE.Vector3(0, 0, -1) };

/**
 * Default speed profile: constant for #9. #12 will replace this with
 * a section-driven function. Kept as a free function (not a method) so
 * downstream callers don't have to instantiate anything.
 */
export function getSpeed(_t: number): number {
  return RAIL_SPEED;
}

export function getPlayerArcLength(): number {
  return arcLength(playerTRef.current);
}

export { TOTAL_ARC_LENGTH };
