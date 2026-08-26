import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { MockMusicMap, type SectionName } from '../rail/musicMap';

const VALID_NAMES: ReadonlySet<SectionName> = new Set([
  'intro',
  'build',
  'drop',
  'breakdown',
  'outro',
]);

describe('MockMusicMap', () => {
  const map = new MockMusicMap();

  it('returns a non-empty array of section boundaries', () => {
    const sections = map.sections();
    expect(sections.length).toBeGreaterThan(0);
  });

  it('every boundary has a valid SectionName', () => {
    for (const s of map.sections()) {
      expect(VALID_NAMES.has(s.name)).toBe(true);
    }
  });

  it('startT values are strictly increasing and within (0, 1)', () => {
    const ts = map.sections().map((s) => s.startT);
    for (const t of ts) {
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThan(1);
    }
    for (let i = 1; i < ts.length; i++) {
      expect(ts[i]).toBeGreaterThan(ts[i - 1]);
    }
  });

  it('every curvature is a Vector3 with finite coordinates', () => {
    for (const s of map.sections()) {
      expect(s.curvature).toBeInstanceOf(THREE.Vector3);
      expect(Number.isFinite(s.curvature.x)).toBe(true);
      expect(Number.isFinite(s.curvature.y)).toBe(true);
      expect(Number.isFinite(s.curvature.z)).toBe(true);
    }
  });

  it('curvature magnitudes stay inside the tunnel envelope (<= 3 units)', () => {
    for (const s of map.sections()) {
      expect(s.curvature.length()).toBeLessThanOrEqual(3);
    }
  });

  it('returns a fresh array each call (consumer mutation is safe)', () => {
    const a = map.sections();
    const b = map.sections();
    expect(a).not.toBe(b);
  });
});