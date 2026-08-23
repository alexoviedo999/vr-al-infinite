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

export interface LockOnTarget {
  id: number;
  /** World-space position. Static for the prototype. */
  position: [number, number, number];
  /** 0..1 — fills while aim is in cone, bleeds otherwise. */
  lockProgress: number;
  /** wall-clock ms when this target reached 1.0; null while not fully locked. Oldest-lock wins cascade. */
  lockedAt: number | null;
  /** false after a hit; the prototype respawns after a short delay. */
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
    // Respawn the whole cascade cohort together after the stagger runs
    // out, plus a held "killed" flash window for clarity.
    setTimeout(() => {
      set((state) => ({
        targets: state.targets.map((t) => (ids.includes(t.id) ? { ...t, alive: true, lockProgress: 0, lockedAt: null } : t)),
      }));
    }, ids.length * LOCKON_CASCADE_STAGGER_MS + 1400);
    return ids;
  },
}));
