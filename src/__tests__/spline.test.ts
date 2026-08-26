import * as THREE from 'three';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  arcLength,
  position,
  tangent,
  tFromArcLength,
  getTotalArcLength,
  setControlPoints,
} from '../rail/spline';
import { CONTROL_POINTS } from '../rail/points';

// Spline state is mutable (setControlPoints rebuilds segments + arc-table).
// Each test starts from the authored baseline so prior tests don't leak.
beforeEach(() => {
  setControlPoints(CONTROL_POINTS);
});

describe('spline.position', () => {
  it('returns the first control point at t=0', () => {
    const p = position(0);
    expect(p.x).toBeCloseTo(CONTROL_POINTS[0].x, 6);
    expect(p.y).toBeCloseTo(CONTROL_POINTS[0].y, 6);
    expect(p.z).toBeCloseTo(CONTROL_POINTS[0].z, 6);
  });

  it('returns the last control point at t=1', () => {
    const p = position(1);
    expect(p.x).toBeCloseTo(CONTROL_POINTS[CONTROL_POINTS.length - 1].x, 6);
    expect(p.y).toBeCloseTo(CONTROL_POINTS[CONTROL_POINTS.length - 1].y, 6);
    expect(p.z).toBeCloseTo(CONTROL_POINTS[CONTROL_POINTS.length - 1].z, 6);
  });
});

describe('spline.tangent', () => {
  const samples = [0.0, 0.25, 0.5, 0.75, 1.0];
  it.each(samples)('is unit length at t=%s', (t) => {
    const tan = tangent(t);
    expect(tan.length()).toBeCloseTo(1, 6);
  });
});

describe('spline.arcLength', () => {
  it('returns 0 at t=0 and getTotalArcLength() at t=1', () => {
    expect(arcLength(0)).toBe(0);
    expect(arcLength(1)).toBeCloseTo(getTotalArcLength(), 6);
  });

  it('is monotonically non-decreasing across the 256-entry sample grid', () => {
    const samples = 256;
    let prev = 0;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const s = arcLength(t);
      expect(s).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = s;
    }
  });
});

describe('spline.tFromArcLength', () => {
  it('round-trips within 1e-3 for t ∈ {0.1, 0.3, 0.5, 0.7, 0.9}', () => {
    for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const d = arcLength(t);
      const tBack = tFromArcLength(d);
      expect(tBack).toBeCloseTo(t, 3);
    }
  });

  it('returns 0 at d=0 and 1 at d=getTotalArcLength()', () => {
    expect(tFromArcLength(0)).toBe(0);
    expect(tFromArcLength(getTotalArcLength())).toBe(1);
  });

  it('clamps below 0 to 0 and above getTotalArcLength() to 1', () => {
    expect(tFromArcLength(-1)).toBe(0);
    expect(tFromArcLength(getTotalArcLength() + 100)).toBe(1);
  });
});

describe('spline integration sanity', () => {
  it('getTotalArcLength() is positive and bounded', () => {
    // 5 points spanning -30 units along z; should be roughly 30-35 units
    // (the x/y wobble adds a small amount of extra distance).
    expect(getTotalArcLength()).toBeGreaterThan(30);
    expect(getTotalArcLength()).toBeLessThan(40);
  });

  it('returns Vector3 instances with finite coordinates', () => {
    const p = position(0.5);
    expect(p).toBeInstanceOf(THREE.Vector3);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
    expect(Number.isFinite(p.z)).toBe(true);
  });
});

describe('spline.setControlPoints — runtime rebuild', () => {
  const straight = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -10),
    new THREE.Vector3(0, 0, -20),
    new THREE.Vector3(0, 0, -30),
  ];

  it('rebuilds segments so position(0) reflects the new first control point', () => {
    const newFirst = new THREE.Vector3(5, 5, 0);
    setControlPoints([newFirst, ...straight.slice(1)]);
    const p = position(0);
    expect(p.x).toBeCloseTo(newFirst.x, 6);
    expect(p.y).toBeCloseTo(newFirst.y, 6);
    expect(p.z).toBeCloseTo(newFirst.z, 6);
  });

  it('updates getTotalArcLength() to match the new curve', () => {
    const beforeTotal = getTotalArcLength();
    // Straight -z line of length 30: arc length should be exactly 30.
    setControlPoints(straight);
    const afterTotal = getTotalArcLength();
    expect(beforeTotal).not.toBe(afterTotal);
    expect(afterTotal).toBeCloseTo(30, 1);
  });

  it('arcLength(1) follows the rebuild', () => {
    setControlPoints(straight);
    expect(arcLength(1)).toBeCloseTo(getTotalArcLength(), 6);
  });

  it('tFromArcLength still clamps to 1 at the new total', () => {
    setControlPoints(straight);
    expect(tFromArcLength(getTotalArcLength())).toBe(1);
    expect(tFromArcLength(getTotalArcLength() + 100)).toBe(1);
  });

  it('throws when fewer than 4 control points are provided', () => {
    expect(() => setControlPoints([new THREE.Vector3(), new THREE.Vector3()])).toThrow();
    expect(() => setControlPoints([new THREE.Vector3()])).toThrow();
  });

  it('round-trip still holds after a rebuild', () => {
    setControlPoints(straight);
    for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const d = arcLength(t);
      const tBack = tFromArcLength(d);
      expect(tBack).toBeCloseTo(t, 3);
    }
  });
});