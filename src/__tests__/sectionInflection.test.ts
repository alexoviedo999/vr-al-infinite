import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { position as basePosition, tangent as baseTangent } from '../rail/spline';
import { CONTROL_POINTS } from '../rail/points';
import { injectSectionInflections } from '../rail/sectionInflection';
import type { SectionBoundary } from '../rail/musicMap';

const BASE = CONTROL_POINTS;
const N = BASE.length;

describe('injectSectionInflections — empty / degenerate input', () => {
  it('returns the base points (copy) when no boundaries are provided', () => {
    const out = injectSectionInflections(BASE, []);
    expect(out).toHaveLength(N);
    for (let i = 0; i < N; i++) {
      expect(out[i].x).toBeCloseTo(BASE[i].x, 6);
      expect(out[i].y).toBeCloseTo(BASE[i].y, 6);
      expect(out[i].z).toBeCloseTo(BASE[i].z, 6);
    }
  });

  it('returns a fresh array (does not mutate the base input)', () => {
    const snapshot = BASE.map((v) => v.clone());
    injectSectionInflections(BASE, [
      { name: 'drop', startT: 0.5, curvature: new THREE.Vector3(0.5, 0, 0) },
    ]);
    for (let i = 0; i < N; i++) {
      expect(BASE[i].x).toBe(snapshot[i].x);
      expect(BASE[i].y).toBe(snapshot[i].y);
      expect(BASE[i].z).toBe(snapshot[i].z);
    }
  });

  it('skips boundaries with startT <= 0', () => {
    const out = injectSectionInflections(BASE, [
      { name: 'intro', startT: 0, curvature: new THREE.Vector3(1, 0, 0) },
      { name: 'pre', startT: -0.1, curvature: new THREE.Vector3(1, 0, 0) },
    ]);
    expect(out).toHaveLength(N);
  });

  it('skips boundaries with startT >= 1', () => {
    const out = injectSectionInflections(BASE, [
      { name: 'outro', startT: 1, curvature: new THREE.Vector3(1, 0, 0) },
      { name: 'post', startT: 1.5, curvature: new THREE.Vector3(1, 0, 0) },
    ]);
    expect(out).toHaveLength(N);
  });

  it('skips boundaries with zero-length curvature', () => {
    const out = injectSectionInflections(BASE, [
      { name: 'drop', startT: 0.5, curvature: new THREE.Vector3(0, 0, 0) },
    ]);
    expect(out).toHaveLength(N);
  });
});

describe('injectSectionInflections — single boundary', () => {
  it('inserts exactly one new point when one non-zero boundary is provided', () => {
    const out = injectSectionInflections(BASE, [
      { name: 'drop', startT: 0.5, curvature: new THREE.Vector3(0.5, 0.0, 0) },
    ]);
    expect(out).toHaveLength(N + 1);
  });

  it('the inserted point equals basePosition(t) + basis · curvature', () => {
    const curv = new THREE.Vector3(0.7, 0.3, 0);
    const t = 0.5;
    const out = injectSectionInflections(BASE, [
      { name: 'drop', startT: t, curvature: curv },
    ]);
    const anchor = basePosition(t);
    const tan = baseTangent(t);
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, tan).normalize();
    const upN = new THREE.Vector3().crossVectors(tan, right).normalize();
    const expected = new THREE.Vector3()
      .copy(anchor)
      .addScaledVector(right, curv.x)
      .addScaledVector(upN, curv.y)
      .addScaledVector(tan, curv.z);

    // indexBefore(5, 0.5) = round(2) = 2, so the inflection is spliced
    // before base[2], landing at out[2].
    const inserted = out[2];
    expect(inserted.x).toBeCloseTo(expected.x, 6);
    expect(inserted.y).toBeCloseTo(expected.y, 6);
    expect(inserted.z).toBeCloseTo(expected.z, 6);
  });
});

describe('injectSectionInflections — multiple boundaries', () => {
  const four: SectionBoundary[] = [
    { name: 'intro',     startT: 0.10, curvature: new THREE.Vector3( 0.0,  0.6, 0) },
    { name: 'build',     startT: 0.25, curvature: new THREE.Vector3( 0.0,  1.4, 0) },
    { name: 'drop',      startT: 0.55, curvature: new THREE.Vector3( 1.8, -0.6, 0) },
    { name: 'breakdown', startT: 0.80, curvature: new THREE.Vector3(-1.2,  0.4, 0) },
  ];

  it('inserts one new point per valid boundary', () => {
    const out = injectSectionInflections(BASE, four);
    expect(out).toHaveLength(N + four.length);
  });

  it('preserves every base point in order somewhere in the augmented array', () => {
    const out = injectSectionInflections(BASE, four);
    expect(out).toHaveLength(N + four.length);
    // Every base point must appear, in order, in the augmented array.
    // (The first/last entries are NOT necessarily base[0]/base[N-1]:
    // an insertion at a small enough startT lands at index 0 and
    // precedes the base endpoint.)
    let cursor = 0;
    for (const b of BASE) {
      let found = -1;
      for (let i = cursor; i < out.length; i++) {
        if (
          Math.abs(out[i].x - b.x) < 1e-6 &&
          Math.abs(out[i].y - b.y) < 1e-6 &&
          Math.abs(out[i].z - b.z) < 1e-6
        ) {
          found = i;
          break;
        }
      }
      expect(found).toBeGreaterThanOrEqual(cursor);
      cursor = found + 1;
    }
  });

  it('handles out-of-order boundaries by sorting them internally', () => {
    const shuffled: SectionBoundary[] = [four[3], four[0], four[2], four[1]];
    const outSorted = injectSectionInflections(BASE, four);
    const outShuffled = injectSectionInflections(BASE, shuffled);
    expect(outSorted).toHaveLength(outShuffled.length);
    for (let i = 0; i < outSorted.length; i++) {
      expect(outSorted[i].x).toBeCloseTo(outShuffled[i].x, 6);
      expect(outSorted[i].y).toBeCloseTo(outShuffled[i].y, 6);
      expect(outSorted[i].z).toBeCloseTo(outShuffled[i].z, 6);
    }
  });
});

describe('injectSectionInflections — does not mutate the spline module state', () => {
  it('after running, the active spline is still the base curve', () => {
    const before = basePosition(0.5).clone();
    injectSectionInflections(BASE, [
      { name: 'drop', startT: 0.5, curvature: new THREE.Vector3(1.0, 0, 0) },
    ]);
    const after = basePosition(0.5);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(after.z).toBeCloseTo(before.z, 6);
  });
});