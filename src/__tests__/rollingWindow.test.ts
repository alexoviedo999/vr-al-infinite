import * as THREE from 'three';
import {
  arcLengthOfOrbAnchor,
  basisAt,
  ORB_BEHIND_BUFFER,
  ORB_SPAWN_MIN_GAP,
  ORB_WINDOW_SIZE,
  rollOrbs,
  TUNNEL_RADIUS,
  worldPosOf,
  type Basis,
  type RollingOrb,
} from '../orbs/rollingWindow';

const STUB_TOTAL_ARC = 30;

const stubPosition = (t: number): THREE.Vector3 =>
  new THREE.Vector3(0, 0, -t * STUB_TOTAL_ARC);

const stubBasisAt = (_t: number): Basis => ({
  right: new THREE.Vector3(-1, 0, 0),
  up: new THREE.Vector3(0, 1, 0),
  forward: new THREE.Vector3(0, 0, -1),
});

const stubTFromArc = (d: number): number =>
  Math.max(0, Math.min(1, d / STUB_TOTAL_ARC));

const makeOrb = (id: number, anchorT: number, opts: Partial<RollingOrb> = {}): RollingOrb => ({
  id,
  anchorT,
  offset: [0, 0, 0],
  lockProgress: 0,
  lockedAt: null,
  alive: true,
  ...opts,
});

const initialOrbs: RollingOrb[] = [
  makeOrb(1, 0.1),
  makeOrb(2, 0.2),
  makeOrb(3, 0.3),
  makeOrb(4, 0.4),
  makeOrb(5, 0.5),
  makeOrb(6, 0.6),
];

const rollFromOrigin = (overrides: Partial<RollingOrb>[] = []) => {
  const orbs = initialOrbs.map((o, i) => ({ ...o, ...(overrides[i] ?? {}) }));
  return rollOrbs(orbs, 0, STUB_TOTAL_ARC, stubTFromArc, stubBasisAt, stubPosition);
};

describe('rollOrbs — output shape', () => {
  it('output length is exactly ORB_WINDOW_SIZE', () => {
    expect(rollFromOrigin()).toHaveLength(ORB_WINDOW_SIZE);
  });

  it('output length is ORB_WINDOW_SIZE regardless of player position', () => {
    expect(rollFromOrigin().length).toBe(6);
    expect(
      rollOrbs(initialOrbs, 15, STUB_TOTAL_ARC, stubTFromArc, stubBasisAt, stubPosition).length,
    ).toBe(6);
    expect(
      rollOrbs(initialOrbs, 29, STUB_TOTAL_ARC, stubTFromArc, stubBasisAt, stubPosition).length,
    ).toBe(6);
  });
});

describe('rollOrbs — arc-length constraint', () => {
  it('all alive output orbs have anchorT ≥ playerArcLength - ORB_BEHIND_BUFFER * totalArcLength', () => {
    const playerArc = 5;
    const result = rollOrbs(initialOrbs, playerArc, STUB_TOTAL_ARC, stubTFromArc, stubBasisAt, stubPosition);
    const threshold = playerArc - ORB_BEHIND_BUFFER * STUB_TOTAL_ARC;
    for (const orb of result) {
      expect(orb.alive).toBe(true);
      expect(arcLengthOfOrbAnchor(orb, STUB_TOTAL_ARC)).toBeGreaterThanOrEqual(threshold - 1e-9);
    }
  });
});

describe('rollOrbs — tunnel-radius constraint', () => {
  it('all alive orbs have world-space distance from the spline ≤ TUNNEL_RADIUS', () => {
    const result = rollFromOrigin();
    for (const orb of result) {
      const orbPos = worldPosOf(orb, stubBasisAt, stubPosition);
      const splinePos = stubPosition(orb.anchorT);
      const dist = Math.hypot(
        orbPos.x - splinePos.x,
        orbPos.y - splinePos.y,
        orbPos.z - splinePos.z,
      );
      expect(dist).toBeLessThanOrEqual(TUNNEL_RADIUS + 1e-9);
    }
  });
});

describe('rollOrbs — ORB_SPAWN_MIN_GAP constraint', () => {
  it('respects ORB_SPAWN_MIN_GAP across 200 random player positions', () => {
    for (let trial = 0; trial < 200; trial++) {
      const playerArc = Math.random() * STUB_TOTAL_ARC;
      const result = rollOrbs(initialOrbs, playerArc, STUB_TOTAL_ARC, stubTFromArc, stubBasisAt, stubPosition);
      const positions = result.map((o) => worldPosOf(o, stubBasisAt, stubPosition));
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const d = positions[i].distanceTo(positions[j]);
          expect(d).toBeGreaterThanOrEqual(ORB_SPAWN_MIN_GAP - 1e-9);
        }
      }
    }
  });
});

describe('rollOrbs — ID preservation', () => {
  it('IDs of un-recycled orbs are preserved', () => {
    // Player at origin so nothing is recycled.
    const result = rollFromOrigin();
    expect(result.map((o) => o.id).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('rollOrbs — recycling', () => {
  it('a dead orb is recycled: alive becomes true, anchorT advances', () => {
    const deadOrb = makeOrb(1, 0.5, { alive: false });
    const orbs: RollingOrb[] = [
      deadOrb,
      makeOrb(2, 0.1),
      makeOrb(3, 0.2),
      makeOrb(4, 0.3),
      makeOrb(5, 0.4),
      makeOrb(6, 0.5),
    ];
    const result = rollOrbs(orbs, 0, STUB_TOTAL_ARC, stubTFromArc, stubBasisAt, stubPosition);
    const recycled = result.find((o) => o.id === 1);
    expect(recycled).toBeDefined();
    expect(recycled!.alive).toBe(true);
    expect(recycled!.anchorT).toBeGreaterThan(0.5);
  });

  it('an orb whose anchorT is behind the player by ORB_BEHIND_BUFFER is recycled', () => {
    // Player at arc=5 → threshold ≈ 5 - 0.02*30 = 4.4. Orbs with arc
    // length < 4.4 (anchorT < 0.147) are recycled.
    const behindOrb = makeOrb(1, 0.1); // arc length 3 — behind threshold
    const orbs: RollingOrb[] = [
      behindOrb,
      makeOrb(2, 0.5),
      makeOrb(3, 0.55),
      makeOrb(4, 0.6),
      makeOrb(5, 0.65),
      makeOrb(6, 0.7),
    ];
    const result = rollOrbs(orbs, 5, STUB_TOTAL_ARC, stubTFromArc, stubBasisAt, stubPosition);
    const recycled = result.find((o) => o.id === 1);
    expect(recycled).toBeDefined();
    expect(recycled!.alive).toBe(true);
    expect(recycled!.anchorT).toBeGreaterThan(0.1);
  });
});

describe('basisAt', () => {
  it('returns an orthonormal frame for a tangent along -Z', () => {
    const b = basisAt(0.5);
    expect(b.forward.length()).toBeCloseTo(1, 6);
    expect(b.right.dot(b.up)).toBeCloseTo(0, 6);
    expect(b.right.dot(b.forward)).toBeCloseTo(0, 6);
    expect(b.up.dot(b.forward)).toBeCloseTo(0, 6);
  });
});
