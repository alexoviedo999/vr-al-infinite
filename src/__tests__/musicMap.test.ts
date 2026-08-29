import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { MockMusicMap, type SectionName } from '../rail/musicMap';
import { RealMusicMap } from '../audio/RealMusicMap';
import type { SerializedMusicMap } from '../audio/sectionFromAnalysis';

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

  it('every section carries a finite, non-negative velocity multiplier (#12)', () => {
    for (const s of map.sections()) {
      expect(Number.isFinite(s.velocity)).toBe(true);
      expect(s.velocity).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns a fresh array each call (consumer mutation is safe)', () => {
    const a = map.sections();
    const b = map.sections();
    expect(a).not.toBe(b);
  });

  it('ships a 120 BPM beat grid and a duration', () => {
    expect(map.durationSec()).toBe(60);
    const beats = map.beats();
    expect(beats[0]).toBe(0);
    expect(beats[1]).toBeCloseTo(0.5, 5);
    expect(beats.length).toBe(120);
  });

  it('ships non-zero visual curvature inside the tunnel envelope', () => {
    const drop = map.sections().find((s) => s.name === 'drop');
    expect(drop).toBeDefined();
    expect(drop!.curvature.length()).toBeGreaterThan(0.2);
  });
});

describe('RealMusicMap', () => {
  const serialized: SerializedMusicMap = {
    trackId: 'test-track',
    durationSec: 120,
    bpm: 122,
    beats: [0, 0.5, 1],
    sections: [
      { name: 'intro', startT: 0.1, velocity: 0.6, curvature: [0, 0, 0] },
      { name: 'drop', startT: 0.5, velocity: 1.4, curvature: [0, 0, 0] },
    ],
  };

  it('implements MusicMap from a serialized worker artifact', () => {
    const real = new RealMusicMap(serialized);
    const sections = real.sections();
    expect(sections).toHaveLength(2);
    expect(sections[1].name).toBe('drop');
    expect(sections[1].curvature).toBeInstanceOf(THREE.Vector3);
    expect(real.sections()).not.toBe(sections);
    expect(real.beats()).toEqual([0, 0.5, 1]);
    expect(real.durationSec()).toBe(120);
  });
});