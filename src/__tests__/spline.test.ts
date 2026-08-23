import * as THREE from 'three';
import {
  arcLength,
  position,
  tangent,
  tFromArcLength,
  TOTAL_ARC_LENGTH,
} from '../rail/spline';
import { CONTROL_POINTS } from '../rail/points';

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
  it('returns 0 at t=0 and TOTAL_ARC_LENGTH at t=1', () => {
    expect(arcLength(0)).toBe(0);
    expect(arcLength(1)).toBeCloseTo(TOTAL_ARC_LENGTH, 6);
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

  it('returns 0 at d=0 and 1 at d=TOTAL_ARC_LENGTH', () => {
    expect(tFromArcLength(0)).toBe(0);
    expect(tFromArcLength(TOTAL_ARC_LENGTH)).toBe(1);
  });

  it('clamps below 0 to 0 and above TOTAL_ARC_LENGTH to 1', () => {
    expect(tFromArcLength(-1)).toBe(0);
    expect(tFromArcLength(TOTAL_ARC_LENGTH + 100)).toBe(1);
  });
});

describe('spline integration sanity', () => {
  it('TOTAL_ARC_LENGTH is positive and bounded', () => {
    // 5 points spanning -30 units along z; should be roughly 30-35 units
    // (the x/y wobble adds a small amount of extra distance).
    expect(TOTAL_ARC_LENGTH).toBeGreaterThan(30);
    expect(TOTAL_ARC_LENGTH).toBeLessThan(40);
  });

  it('returns Vector3 instances with finite coordinates', () => {
    const p = position(0.5);
    expect(p).toBeInstanceOf(THREE.Vector3);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
    expect(Number.isFinite(p.z)).toBe(true);
  });
});
