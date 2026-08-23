import { create } from 'zustand';
import * as THREE from 'three';

/**
 * Lock-on prototype state for ticket #6. Tracks a fixed set of static
 * targets, per-target lock progress (0..1), and fires them in a
 * staggered cascade when the player pulls the trigger.
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

export interface LockOnTarget {
  id: number;
  /** World-space position. Re-rolled to a fresh spot on every respawn. */
  position: [number, number, number];
  /** 0..1 — fills while aim is in cone, bleeds otherwise. */
  lockProgress: number;
  /** wall-clock ms when this target reached 1.0; null while not fully locked. Oldest-lock wins cascade. */
  lockedAt: number | null;
  /** false after a hit; the prototype respawns after LOCKON_RESPAWN_MS. */
  alive: boolean;
}

interface LockOnState {
  targets: LockOnTarget[];
  /** Aim direction in world space. Updated every frame by the prototype scene. */
  aimDir: THREE.Vector3;
  /** Updated every frame; runs the cone test against `aimDir`. */
  tick: (aimDir: THREE.Vector3, dt: number, nowMs: number) => void;
  /** Trigger the cascade fire. Returns the ids in fire order (oldest-lock first). */
  fire: () => number[];
}

/** Spawn-bounding box — matches the spread of the original INITIAL_TARGETS. */
const SPAWN_X_HALF = 2.5;
const SPAWN_Y_HALF = 1.3;
const SPAWN_Z_MIN = -11;
const SPAWN_Z_MAX = -6;
const SPAWN_MIN_GAP = 1.6; // keep respawning targets from landing on each other

const randomTargetPosition = (
  existing: LockOnTarget[],
  excludeIds: ReadonlySet<number>,
): [number, number, number] => {
  for (let attempt = 0; attempt < 16; attempt++) {
    const x = (Math.random() * 2 - 1) * SPAWN_X_HALF;
    const y = (Math.random() * 2 - 1) * SPAWN_Y_HALF;
    const z = SPAWN_Z_MIN + Math.random() * (SPAWN_Z_MAX - SPAWN_Z_MIN);
    const collides = existing.some(
      (t) => excludeIds.has(t.id) || Math.hypot(t.position[0] - x, t.position[1] - y, t.position[2] - z) < SPAWN_MIN_GAP,
    );
    if (!collides) return [x, y, z];
  }
  // Couldn't find a clear spot in 16 rolls — accept whatever the last
  // roll produced so the prototype never deadlocks.
  return [
    (Math.random() * 2 - 1) * SPAWN_X_HALF,
    (Math.random() * 2 - 1) * SPAWN_Y_HALF,
    SPAWN_Z_MIN + Math.random() * (SPAWN_Z_MAX - SPAWN_Z_MIN),
  ];
};

const INITIAL_TARGETS: LockOnTarget[] = [
  { id: 1, position: [-2.4, 0.6, -6], lockProgress: 0, lockedAt: null, alive: true },
  { id: 2, position: [2.2, -0.4, -7], lockProgress: 0, lockedAt: null, alive: true },
  { id: 3, position: [-0.8, 1.4, -8], lockProgress: 0, lockedAt: null, alive: true },
  { id: 4, position: [0.4, -1.2, -9], lockProgress: 0, lockedAt: null, alive: true },
  { id: 5, position: [1.6, 0.8, -10], lockProgress: 0, lockedAt: null, alive: true },
  { id: 6, position: [-1.6, -0.8, -11], lockProgress: 0, lockedAt: null, alive: true },
];

export const useLockOnStore = create<LockOnState>((set, get) => ({
  targets: INITIAL_TARGETS,
  aimDir: new THREE.Vector3(0, 0, -1),

  tick: (aimDir, dt, nowMs) => {
    const cosThreshold = Math.cos(LOCKON_CONE_HALF_ANGLE_RAD);
    set((state) => {
      const next = state.targets.map((t) => {
        if (!t.alive) return t;
        const dir = new THREE.Vector3(...t.position).normalize();
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
      return { targets: next, aimDir: aimDir.clone() };
    });
  },

  fire: () => {
    const locked = get()
      .targets.filter((t) => t.alive && t.lockProgress >= 1 && t.lockedAt !== null)
      .sort((a, b) => (a.lockedAt! - b.lockedAt!));
    const ids = locked.slice(0, LOCKON_MAX_TARGETS).map((t) => t.id);
    const idSet = new Set(ids);
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
    // Respawn the whole cascade cohort together with fresh positions so
    // repeated plays don't feel mechanical (issue #6 follow-up).
    setTimeout(() => {
      set((state) => ({
        targets: state.targets.map((t) =>
          idSet.has(t.id)
            ? {
                ...t,
                alive: true,
                lockProgress: 0,
                lockedAt: null,
                position: randomTargetPosition(state.targets, idSet),
              }
            : t,
        ),
      }));
    }, ids.length * LOCKON_CASCADE_STAGGER_MS + LOCKON_RESPAWN_MS);
    return ids;
  },
}));
