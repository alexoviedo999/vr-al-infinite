import { describe, it, expect } from 'vitest';
import { velocityAt } from '../rail/sectionVelocity';
import type { SectionBoundary } from '../rail/musicMap';
import * as THREE from 'three';

const ZERO_CURV = new THREE.Vector3(0, 0, 0);

function sec(name: string, startT: number, velocity: number): SectionBoundary {
  return { name: name as SectionBoundary['name'], startT, curvature: ZERO_CURV, velocity };
}

describe('velocityAt — empty input', () => {
  it('returns baseSpeed when no sections are provided', () => {
    expect(velocityAt(0.5, [], 2.5)).toBe(2.5);
  });

  it('returns baseSpeed (no scaling) for any t with empty sections', () => {
    expect(velocityAt(0, [], 3.0)).toBe(3.0);
    expect(velocityAt(0.99, [], 3.0)).toBe(3.0);
  });
});

describe('velocityAt — single section', () => {
  const sections: SectionBoundary[] = [sec('intro', 0.1, 0.5)];

  it('returns baseSpeed × section.velocity inside the section', () => {
    expect(velocityAt(0.1, sections, 2.0)).toBeCloseTo(1.0, 6);
    expect(velocityAt(0.5, sections, 2.0)).toBeCloseTo(1.0, 6);
    expect(velocityAt(0.99, sections, 2.0)).toBeCloseTo(1.0, 6);
  });

  it('returns first-section velocity for t before its startT', () => {
    expect(velocityAt(0.05, sections, 2.0)).toBeCloseTo(1.0, 6);
    expect(velocityAt(0, sections, 2.0)).toBeCloseTo(1.0, 6);
  });
});

describe('velocityAt — multiple sorted sections', () => {
  const sections: SectionBoundary[] = [
    sec('intro', 0.10, 0.6),
    sec('drop', 0.55, 1.4),
    sec('breakdown', 0.80, 0.8),
  ];

  it('uses the largest startT ≤ t (step-function transitions)', () => {
    expect(velocityAt(0.09, sections, 2.5)).toBeCloseTo(1.5, 6); // before intro → intro
    expect(velocityAt(0.10, sections, 2.5)).toBeCloseTo(1.5, 6); // at intro boundary → intro
    expect(velocityAt(0.30, sections, 2.5)).toBeCloseTo(1.5, 6); // inside intro → intro
    expect(velocityAt(0.54, sections, 2.5)).toBeCloseTo(1.5, 6); // just before drop → intro
    expect(velocityAt(0.55, sections, 2.5)).toBeCloseTo(3.5, 6); // at drop boundary → drop
    expect(velocityAt(0.70, sections, 2.5)).toBeCloseTo(3.5, 6); // inside drop → drop
    expect(velocityAt(0.79, sections, 2.5)).toBeCloseTo(3.5, 6); // just before breakdown → drop
    expect(velocityAt(0.80, sections, 2.5)).toBeCloseTo(2.0, 6); // at breakdown → breakdown
    expect(velocityAt(0.99, sections, 2.5)).toBeCloseTo(2.0, 6); // past last section → last
  });

  it('scales linearly with baseSpeed', () => {
    expect(velocityAt(0.7, sections, 2.5)).toBeCloseTo(3.5, 6);
    expect(velocityAt(0.7, sections, 5.0)).toBeCloseTo(7.0, 6);
    expect(velocityAt(0.7, sections, 0.0)).toBeCloseTo(0.0, 6);
  });
});

describe('velocityAt — velocity=1.0 is a no-op', () => {
  const sections: SectionBoundary[] = [
    sec('intro', 0.10, 1.0),
    sec('drop', 0.55, 1.0),
    sec('breakdown', 0.80, 1.0),
  ];

  it('returns baseSpeed at every t when every section has velocity 1.0', () => {
    for (const t of [0, 0.05, 0.10, 0.30, 0.55, 0.70, 0.80, 0.99]) {
      expect(velocityAt(t, sections, 2.5)).toBeCloseTo(2.5, 6);
    }
  });
});