import * as THREE from 'three';
import {
  LOCKON_CASCADE_STAGGER_MS,
  LOCKON_FILL_SECONDS,
  LOCKON_MAX_TARGETS,
  LOCKON_RESPAWN_MS,
  useLockOnStore,
} from '../state/lockOnStore';
import type { LockOnTarget } from '../state/lockOnStore';

const reset = () => {
  useLockOnStore.setState((s) => ({
    ...s,
    targets: s.targets.map((t) => ({ ...t, lockProgress: 0, lockedAt: null, alive: true })),
  }));
};

const aimAt = (t: LockOnTarget) => new THREE.Vector3(...t.position).normalize();

describe('lockOnStore.tick', () => {
  beforeEach(reset);

  it('fills lockProgress toward 1 while aim is inside the cone', () => {
    const target = useLockOnStore.getState().targets[0];
    const aim = aimAt(target);
    const stepMs = (LOCKON_FILL_SECONDS * 1000) / 4; // quarter of the fill time
    for (let i = 0; i < 4; i++) {
      useLockOnStore.getState().tick(aim, stepMs / 1000, performance.now() + i * stepMs);
    }
    const after = useLockOnStore.getState().targets[0];
    expect(after.lockProgress).toBeGreaterThanOrEqual(0.99);
    expect(after.lockProgress).toBeLessThanOrEqual(1);
    expect(after.lockedAt).not.toBeNull();
  });

  it('decays lockProgress when aim leaves the cone', () => {
    const target = useLockOnStore.getState().targets[0];
    const on = aimAt(target);
    const off = on.clone().multiplyScalar(-1); // opposite direction
    // Pre-fill to ~0.8
    useLockOnStore.getState().tick(on, LOCKON_FILL_SECONDS * 0.8, 0);
    expect(useLockOnStore.getState().targets[0].lockProgress).toBeGreaterThan(0.7);
    // Now aim away for 0.2s at 2.5/s decay → should erase ~0.5
    useLockOnStore.getState().tick(off, 0.2, 100);
    expect(useLockOnStore.getState().targets[0].lockProgress).toBeLessThanOrEqual(0.5);
  });
});

describe('lockOnStore.fire', () => {
  beforeEach(reset);

  it('returns ids sorted oldest-lock-first and capped at LOCKON_MAX_TARGETS', async () => {
    const targets = useLockOnStore.getState().targets;
    const now = performance.now();
    // Lock three targets at staggered times; the rest stay at 0.
    targets.slice(0, 3).forEach((t, i) => {
      useLockOnStore.setState((s) => ({
        targets: s.targets.map((u) =>
          u.id === t.id ? { ...u, lockProgress: 1, lockedAt: now + i * 10 } : u,
        ),
      }));
    });
    // Lock a fourth with the same lockedAt as the 3rd to exercise the cap.
    useLockOnStore.setState((s) => ({
      targets: s.targets.map((u) =>
        u.id === targets[3].id ? { ...u, lockProgress: 1, lockedAt: now + 20 } : u,
      ),
    }));

    const ids = useLockOnStore.getState().fire();
    expect(ids).toEqual([targets[0].id, targets[1].id, targets[2].id, targets[3].id]);
    expect(ids.length).toBeLessThanOrEqual(LOCKON_MAX_TARGETS);
  });

  it('marks fired targets dead and respawns them on a delay', async () => {
    const t = useLockOnStore.getState().targets[0];
    useLockOnStore.setState((s) => ({
      targets: s.targets.map((u) =>
        u.id === t.id ? { ...u, lockProgress: 1, lockedAt: performance.now() } : u,
      ),
    }));
    const ids = useLockOnStore.getState().fire();
    // The kill is scheduled on a setTimeout per id (cascade stagger). With
    // one target the stagger is 0ms but the timer is still queued, so we
    // yield once before reading `alive`.
    await new Promise((r) => setTimeout(r, LOCKON_CASCADE_STAGGER_MS + 5));
    expect(useLockOnStore.getState().targets[0].alive).toBe(false);
    await new Promise((r) => setTimeout(r, ids.length * LOCKON_CASCADE_STAGGER_MS + LOCKON_RESPAWN_MS + 100));
    expect(useLockOnStore.getState().targets[0].alive).toBe(true);
  });

  it('re-rolls respawn position so repeated plays don\'t feel mechanical', async () => {
    const t = useLockOnStore.getState().targets[0];
    const originalPosition = [...t.position] as [number, number, number];
    useLockOnStore.setState((s) => ({
      targets: s.targets.map((u) =>
        u.id === t.id ? { ...u, lockProgress: 1, lockedAt: performance.now() } : u,
      ),
    }));
    expect(useLockOnStore.getState().fire().includes(t.id)).toBe(true);
    await new Promise((r) => setTimeout(r, LOCKON_CASCADE_STAGGER_MS + LOCKON_RESPAWN_MS + 100));
    const after = useLockOnStore.getState().targets.find((u) => u.id === t.id)!;
    expect(after.alive).toBe(true);
    // Probability that 5 re-rolls of a continuous box land back on the
    // exact starting tuple is effectively zero. Check at least one axis
    // moved by ≥0.05 (well above float jitter) so a partial match doesn't
    // sneak through.
    const moved = after.position.some((coord, i) => Math.abs(coord - originalPosition[i]) > 0.05);
    expect(moved).toBe(true);
  });

  it('returns [] when nothing is locked', () => {
    expect(useLockOnStore.getState().fire()).toEqual([]);
  });
});
