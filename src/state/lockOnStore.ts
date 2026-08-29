import { create } from 'zustand';
import * as THREE from 'three';
import {
  arcLengthOfOrbAnchor,
  basisAt as defaultBasisAt,
  rollOrbs,
  worldPosOf as defaultWorldPosOf,
  type Basis,
} from '../orbs/rollingWindow';
import { useTuningStore } from './tuningStore';

/**
 * Lock-on state for tickets #6 (cone-based lockon prototype) and #9
 * (forward rail motion). Tracks a set of targets, per-target lock
 * progress (0..1), and fires them in a staggered cascade when the
 * player pulls the trigger.
 *
 * Targets are stored as (anchorT, offset) pairs rather than absolute
 * world positions, so when #10 reshapes the spline via setSpline the
 * orbs follow the curve without re-emitting position data. With no
 * spline set (LockOnPrototype path) the store falls back to treating
 * `offset` as the world position — the cone math then degenerates to
 * the original origin-relative form when playerPos is also origin.
 *
 * Tunables (set from a screenRecording of Rez Infinite; see issue #6
 * comment for the reasoning behind each constant).
 */
export const LOCKON_CONE_HALF_ANGLE_RAD = (8 * Math.PI) / 180; // ~8° half-angle
export const LOCKON_FILL_SECONDS = 0.4; // time to go 0 → 1 while aim stays on target
export const LOCKON_DECAY_PER_SEC = 2.5; // rate at which lock progress bleeds off when aim leaves
export const LOCKON_CASCADE_STAGGER_MS = 50; // ms between successive hits in the cascade
export const LOCKON_MAX_TARGETS = 8; // Rez-style cap
export const LOCKON_RESPAWN_MS = 1400; // held "killed" window before respawn

/**
 * Spline interface used by the lock-on store to resolve world positions
 * during the cone test. Matches the public surface of `rail/spline.ts`
 * but declared here so lockOnStore.ts doesn't import from `rail/`.
 */
export interface ISpline {
  position(t: number): THREE.Vector3;
  tangent(t: number): THREE.Vector3;
  arcLength(t: number): number;
  tFromArcLength(d: number): number;
}

export interface LockOnTarget {
  id: number;
  anchorT: number;
  offset: [number, number, number];
  lockProgress: number;
  lockedAt: number | null;
  alive: boolean;
}

export interface LastCascade {
  ids: number[];
  atMs: number;
}

interface LockOnState {
  targets: LockOnTarget[];
  /** Set once by `setSpline` from the rail prototype; null in the lockon-only fallback path. */
  spline: ISpline | null;
  /** Cached arc-length(1) of the active spline; populated by setSpline. */
  totalArcLength: number;
  aimDir: THREE.Vector3;
  /** Most recent non-empty fire(); shooting FX subscribe to this. */
  lastCascade: LastCascade | null;

  setSpline: (spline: ISpline | null) => void;
  resetRailTargets: () => void;
  tick: (aimDir: THREE.Vector3, playerPos: THREE.Vector3, dt: number, nowMs: number) => void;
  /** Recycle orbs that have fallen behind the player (or died) to fresh anchors ahead. */
  recyclePassed: (playerArcLength: number) => void;
  fire: (playerArcLength: number) => number[];
}

/**
 * Initial targets. With no spline set, `offset` is interpreted as the
 * world position (fallback path — LockOnPrototype); when a spline is
 * set via setSpline, world position = spline.position(anchorT) +
 * basis(anchorT) · offset. anchorT defaults to 0 here.
 */
const INITIAL_TARGETS: LockOnTarget[] = [
  { id: 1, anchorT: 0, offset: [-2.4, 0.6, -6], lockProgress: 0, lockedAt: null, alive: true },
  { id: 2, anchorT: 0, offset: [2.2, -0.4, -7], lockProgress: 0, lockedAt: null, alive: true },
  { id: 3, anchorT: 0, offset: [-0.8, 1.4, -8], lockProgress: 0, lockedAt: null, alive: true },
  { id: 4, anchorT: 0, offset: [0.4, -1.2, -9], lockProgress: 0, lockedAt: null, alive: true },
  { id: 5, anchorT: 0, offset: [1.6, 0.8, -10], lockProgress: 0, lockedAt: null, alive: true },
  { id: 6, anchorT: 0, offset: [-1.6, -0.8, -11], lockProgress: 0, lockedAt: null, alive: true },
];

/**
 * Arc-length-distributed initial state for rail mode. Built from a
 * configurable lower bound (read from the tuning store at setSpline
 * time) so the DebugPanel can re-space the first orb. Lateral offsets
 * stay within TUNNEL_RADIUS; along-tangent component is zero so orbs
 * sit on the rail's cross-section.
 */
const RAIL_ORB_STEP = 0.10;
const RAIL_ORB_OFFSETS: [number, number, number][] = [
  [-2.0, 0.8, 0],
  [1.8, -0.6, 0],
  [-1.0, 1.4, 0],
  [1.6, 0.4, 0],
  [-1.4, -1.0, 0],
  [0.6, 1.2, 0],
];

function buildRailInitialTargets(firstOrbAnchorT: number): LockOnTarget[] {
  return RAIL_ORB_OFFSETS.map((offset, i) => ({
    id: i + 1,
    anchorT: Math.min(0.95, firstOrbAnchorT + i * RAIL_ORB_STEP),
    offset,
    lockProgress: 0,
    lockedAt: null,
    alive: true,
  }));
}

/**
 * Fallback respawn for the lockon-only prototype path (no spline set).
 * Picks a fresh world-space position in the original bounding box,
 * preserving the mechanical-feel re-roll from #6.
 */
const SPAWN_X_HALF = 2.5;
const SPAWN_Y_HALF = 1.3;
const SPAWN_Z_MIN = -11;
const SPAWN_Z_MAX = -6;
const SPAWN_MIN_GAP = 1.6;

const fallbackRespawn = (
  existing: LockOnTarget[],
  excludeIds: ReadonlySet<number>,
): [number, number, number] => {
  for (let attempt = 0; attempt < 16; attempt++) {
    const x = (Math.random() * 2 - 1) * SPAWN_X_HALF;
    const y = (Math.random() * 2 - 1) * SPAWN_Y_HALF;
    const z = SPAWN_Z_MIN + Math.random() * (SPAWN_Z_MAX - SPAWN_Z_MIN);
    const collides = existing.some(
      (t) => excludeIds.has(t.id) || Math.hypot(t.offset[0] - x, t.offset[1] - y, t.offset[2] - z) < SPAWN_MIN_GAP,
    );
    if (!collides) return [x, y, z];
  }
  return [
    (Math.random() * 2 - 1) * SPAWN_X_HALF,
    (Math.random() * 2 - 1) * SPAWN_Y_HALF,
    SPAWN_Z_MIN + Math.random() * (SPAWN_Z_MAX - SPAWN_Z_MIN),
  ];
};

export const useLockOnStore = create<LockOnState>((set, get) => ({
  targets: INITIAL_TARGETS,
  spline: null,
  totalArcLength: 0,
  aimDir: new THREE.Vector3(0, 0, -1),
  lastCascade: null,

  setSpline: (spline) => {
    if (spline) {
      set({
        spline,
        totalArcLength: spline.arcLength(1),
        targets: buildRailInitialTargets(useTuningStore.getState().firstOrbAnchorT),
      });
    } else {
      set({ spline: null, totalArcLength: 0 });
    }
  },

  /** Re-populate targets from the current tuning-store lower bound. Used
   *  by the DebugPanel when first-orb-anchor changes mid-session. */
  resetRailTargets: () => {
    set({ targets: buildRailInitialTargets(useTuningStore.getState().firstOrbAnchorT) });
  },

  tick: (aimDir, playerPos, dt, nowMs) => {
    const cosThreshold = Math.cos(LOCKON_CONE_HALF_ANGLE_RAD);
    const state = get();
    const spline = state.spline;
    const next = state.targets.map((t) => {
      if (!t.alive) return t;

      let worldPos: THREE.Vector3;
      if (spline) {
        worldPos = defaultWorldPosOf(t, defaultBasisAt, spline.position);
      } else {
        // Fallback: offset IS the world position. With playerPos = origin,
        // the math degenerates to the original origin-relative cone test.
        worldPos = new THREE.Vector3(t.offset[0], t.offset[1], t.offset[2]);
      }

      const dir = worldPos.sub(playerPos).normalize();
      const dot = aimDir.dot(dir);
      const inCone = dot >= cosThreshold;
      let p = t.lockProgress;
      if (inCone) {
        p = Math.min(1, p + dt / LOCKON_FILL_SECONDS);
      } else {
        p = Math.max(0, p - LOCKON_DECAY_PER_SEC * dt);
      }
      const lockedAt = p >= 1 ? (t.lockedAt ?? nowMs) : null;
      return { ...t, lockProgress: p, lockedAt };
    });
    set({ targets: next, aimDir: aimDir.clone() });
  },

  recyclePassed: (playerArcLength) => {
    const state = get();
    if (!state.spline) return; // No rolling-window logic in fallback mode.
    const next = rollOrbs(
      state.targets,
      playerArcLength,
      state.totalArcLength,
      state.spline.tFromArcLength,
      defaultBasisAt,
      state.spline.position,
    );
    set({ targets: next });
  },

  fire: (playerArcLength) => {
    const locked = get()
      .targets.filter((t) => t.alive && t.lockProgress >= 1 && t.lockedAt !== null)
      .sort((a, b) => a.lockedAt! - b.lockedAt!);
    const ids = locked.slice(0, LOCKON_MAX_TARGETS).map((t) => t.id);
    const idSet = new Set(ids);
    if (ids.length === 0) return ids;
    set({ lastCascade: { ids, atMs: performance.now() } });

    // Stagger the kill so the cascade reads as a chord (Rez-style
    // "you actually scored a multi-hit" feedback), not a single pop.
    ids.forEach((id, i) => {
      setTimeout(() => {
        set((state) => ({
          targets: state.targets.map((t) =>
            t.id === id ? { ...t, alive: false, lockProgress: 0, lockedAt: null } : t,
          ),
        }));
      }, i * LOCKON_CASCADE_STAGGER_MS);
    });

    // Respawn the cascade cohort. With a spline active, recyclePassed
    // runs every frame so killed orbs would also be revived early; the
    // explicit respawn keeps the LOCKON_RESPAWN_MS "held dead" UX
    // uniform between the rail and lockon-only prototypes.
    setTimeout(() => {
      const state = get();
      if (state.spline) {
        const next = rollOrbs(
          state.targets,
          playerArcLength,
          state.totalArcLength,
          state.spline.tFromArcLength,
          defaultBasisAt,
          state.spline.position,
        );
        set({ targets: next });
      } else {
        set((s) => ({
          targets: s.targets.map((t) =>
            idSet.has(t.id)
              ? {
                  ...t,
                  alive: true,
                  lockProgress: 0,
                  lockedAt: null,
                  offset: fallbackRespawn(s.targets, idSet),
                }
              : t,
          ),
        }));
      }
    }, ids.length * LOCKON_CASCADE_STAGGER_MS + LOCKON_RESPAWN_MS);

    return ids;
  },
}));

/** Exported for consumers that need to render targets without importing from `orbs/`. */
export const basisAt: (t: number) => Basis = defaultBasisAt;
export const worldPosOf: (
  target: { anchorT: number; offset: [number, number, number] },
  basisAtFn: (t: number) => Basis,
  positionFn: (t: number) => THREE.Vector3,
) => THREE.Vector3 = defaultWorldPosOf;

// arcLengthOfOrbAnchor is re-exported so test helpers and consumers can
// reach it through the state module without depending on `orbs/`.
export { arcLengthOfOrbAnchor };
