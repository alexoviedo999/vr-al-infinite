import * as THREE from 'three';
import {
  LOCKON_CASCADE_STAGGER_MS,
  LOCKON_FILL_SECONDS,
  LOCKON_MAX_TARGETS,
  LOCKON_RESPAWN_MS,
  useLockOnStore,
  type ISpline,
  type LockOnTarget,
} from '../state/lockOnStore';

const ORIGIN = new THREE.Vector3(0, 0, 0);

const reset = () => {
  useLockOnStore.setState((s) => ({
    ...s,
    targets: s.targets.map((t) => ({ ...t, lockProgress: 0, lockedAt: null, alive: true })),
  }));
};

/**
 * In the fallback path (no spline set) `offset` is interpreted as the
 * world position, so the cone math degenerates to the original
 * origin-relative form when playerPos = origin.
 */
const aimAt = (t: LockOnTarget) => new THREE.Vector3(t.offset[0], t.offset[1], t.offset[2]).normalize();

describe('lockOnStore.tick — fallback path (no spline)', () => {
  beforeEach(reset);

  it('fills lockProgress toward 1 while aim is inside the cone', () => {
    const target = useLockOnStore.getState().targets[0];
    const aim = aimAt(target);
    const stepMs = (LOCKON_FILL_SECONDS * 1000) / 4; // quarter of the fill time
    for (let i = 0; i < 4; i++) {
      useLockOnStore.getState().tick(aim, ORIGIN, stepMs / 1000, performance.now() + i * stepMs);
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
    useLockOnStore.getState().tick(on, ORIGIN, LOCKON_FILL_SECONDS * 0.8, 0);
    expect(useLockOnStore.getState().targets[0].lockProgress).toBeGreaterThan(0.7);
    // Now aim away for 0.2s at 2.5/s decay → should erase ~0.5
    useLockOnStore.getState().tick(off, ORIGIN, 0.2, 100);
    expect(useLockOnStore.getState().targets[0].lockProgress).toBeLessThanOrEqual(0.5);
  });
});

describe('lockOnStore.tick — player-relative math (spline set)', () => {
  beforeEach(reset);

  /**
   * Stub spline: position(t) traces (-2*t, 0, -6) on the XZ plane,
   * tangent is fixed (-1, 0, 0) — degenerate but valid for the cone
   * test. arcLength(t) and tFromArcLength are linear.
   */
  const stubSpline: ISpline = {
    position: (t: number) => new THREE.Vector3(-2 * t, 0, -6),
    tangent: () => new THREE.Vector3(-1, 0, 0),
    arcLength: (t: number) => t * 10,
    tFromArcLength: (d: number) => d / 10,
  };

  it('a target whose anchorT maps to world [-2, 0, -6] is in-cone when player is at [0, 0, 5] and aim is normalize(worldPos - playerPos)', () => {
    useLockOnStore.getState().setSpline(stubSpline);
    // Replace target 0 with one whose anchorT=1 maps to (-2, 0, -6)
    // via the stub spline, and zero offset so worldPos = spline.position(1).
    useLockOnStore.setState((s) => ({
      ...s,
      targets: s.targets.map((t) =>
        t.id === 1 ? { ...t, anchorT: 1, offset: [0, 0, 0], alive: true, lockProgress: 0, lockedAt: null } : t,
      ),
    }));

    const playerPos = new THREE.Vector3(0, 0, 5);
    const aim = new THREE.Vector3(-2, 0, -11).normalize();

    const stepMs = (LOCKON_FILL_SECONDS * 1000) / 4;
    for (let i = 0; i < 4; i++) {
      useLockOnStore.getState().tick(aim, playerPos, stepMs / 1000, performance.now() + i * stepMs);
    }

    expect(useLockOnStore.getState().targets[0].lockProgress).toBeGreaterThanOrEqual(0.99);
  });

  it('a target behind a non-origin player is not in-cone when aim is straight ahead', () => {
    useLockOnStore.getState().setSpline(stubSpline);
    useLockOnStore.setState((s) => ({
      ...s,
      targets: s.targets.map((t) =>
        t.id === 1 ? { ...t, anchorT: 1, offset: [0, 0, 0], alive: true, lockProgress: 0, lockedAt: null } : t,
      ),
    }));

    const playerPos = new THREE.Vector3(0, 0, 5);
    const aim = new THREE.Vector3(0, 0, -1); // straight ahead — misses the target

    const stepMs = (LOCKON_FILL_SECONDS * 1000) / 4;
    for (let i = 0; i < 4; i++) {
      useLockOnStore.getState().tick(aim, playerPos, stepMs / 1000, performance.now() + i * stepMs);
    }

    expect(useLockOnStore.getState().targets[0].lockProgress).toBeLessThan(0.05);
  });
});

describe('lockOnStore.setSpline', () => {
  beforeEach(() => {
    useLockOnStore.setState({ spline: null, totalArcLength: 0 });
  });

  it('caches totalArcLength from the spline', () => {
    const spline: ISpline = {
      position: (t) => new THREE.Vector3(0, 0, -t * 10),
      tangent: () => new THREE.Vector3(0, 0, -1),
      arcLength: (t) => t * 10,
      tFromArcLength: (d) => d / 10,
    };
    useLockOnStore.getState().setSpline(spline);
    expect(useLockOnStore.getState().spline).toBe(spline);
    expect(useLockOnStore.getState().totalArcLength).toBe(10);
  });

  it('clears the spline when set to null', () => {
    useLockOnStore.getState().setSpline({
      position: () => new THREE.Vector3(),
      tangent: () => new THREE.Vector3(0, 0, -1),
      arcLength: () => 1,
      tFromArcLength: () => 1,
    });
    useLockOnStore.getState().setSpline(null);
    expect(useLockOnStore.getState().spline).toBeNull();
    expect(useLockOnStore.getState().totalArcLength).toBe(0);
  });
});

describe('lockOnStore.fire', () => {
  beforeEach(reset);

  it('returns ids sorted oldest-lock-first and capped at LOCKON_MAX_TARGETS', () => {
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

    const ids = useLockOnStore.getState().fire(0);
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
    const ids = useLockOnStore.getState().fire(0);
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
    const originalOffset = [t.offset[0], t.offset[1], t.offset[2]] as [number, number, number];
    useLockOnStore.setState((s) => ({
      targets: s.targets.map((u) =>
        u.id === t.id ? { ...u, lockProgress: 1, lockedAt: performance.now() } : u,
      ),
    }));
    expect(useLockOnStore.getState().fire(0).includes(t.id)).toBe(true);
    await new Promise((r) => setTimeout(r, LOCKON_CASCADE_STAGGER_MS + LOCKON_RESPAWN_MS + 100));
    const after = useLockOnStore.getState().targets.find((u) => u.id === t.id)!;
    expect(after.alive).toBe(true);
    // Probability that 5 re-rolls of a continuous box land back on the
    // exact starting tuple is effectively zero. Check at least one axis
    // moved by ≥0.05 (well above float jitter) so a partial match doesn't
    // sneak through.
    const moved = after.offset.some((coord, i) => Math.abs(coord - originalOffset[i]) > 0.05);
    expect(moved).toBe(true);
  });

  it('returns [] when nothing is locked', () => {
    expect(useLockOnStore.getState().fire(0)).toEqual([]);
  });
});

describe('lockOnStore.recyclePassed', () => {
  beforeEach(reset);

  it('is a no-op when no spline is set', () => {
    const before = useLockOnStore.getState().targets;
    useLockOnStore.getState().recyclePassed(0);
    const after = useLockOnStore.getState().targets;
    expect(after).toBe(before);
  });
});
