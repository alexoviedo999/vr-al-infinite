import { describe, expect, it } from 'vitest';
import {
  delayToNextBeat,
  sectionsFromEnergy,
  type EnergyWindow,
} from '../audio/sectionFromAnalysis';

function windows(pairs: Array<[number, number]>): EnergyWindow[] {
  return pairs.map(([startSec, rms]) => ({ startSec, rms }));
}

describe('sectionsFromEnergy', () => {
  it('labels the loudest window as drop and keeps startT strictly increasing in (0, 1)', () => {
    const sections = sectionsFromEnergy(
      100,
      windows([
        [0, 0.1],
        [20, 0.2],
        [50, 0.9],
        [70, 0.3],
        [90, 0.15],
      ]),
    );
    const names = sections.map((s) => s.name);
    expect(names[0]).toBe('intro');
    expect(names).toContain('drop');
    const ts = sections.map((s) => s.startT);
    for (let i = 1; i < ts.length; i++) {
      expect(ts[i]).toBeGreaterThan(ts[i - 1]);
    }
    for (const t of ts) {
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThan(1);
    }
    const drop = sections.find((s) => s.name === 'drop');
    expect(drop?.velocity).toBe(1.4);
    expect(drop?.curvature[0]).toBeLessThan(0);
    expect(Math.hypot(...drop!.curvature)).toBeLessThanOrEqual(3);
  });

  it('falls back to a three-section mock shape when energy is empty', () => {
    const sections = sectionsFromEnergy(180, []);
    expect(sections.map((s) => s.name)).toEqual(['intro', 'drop', 'breakdown']);
  });

  it('never emits overlapping or out-of-order startT', () => {
    const sections = sectionsFromEnergy(
      60,
      windows([
        [0, 0.5],
        [5, 0.5],
        [10, 0.51],
        [15, 0.9],
        [20, 0.2],
        [55, 0.1],
      ]),
    );
    const ts = sections.map((s) => s.startT);
    expect(new Set(ts).size).toBe(ts.length);
  });
});

describe('delayToNextBeat', () => {
  const beats = [0, 0.5, 1, 1.5, 2];

  it('returns the wait until the next beat when it is soon', () => {
    expect(delayToNextBeat(0.4, beats)).toBeCloseTo(0.1, 5);
  });

  it('plays immediately when the next beat is further than maxWait', () => {
    expect(delayToNextBeat(0.4, beats, 0.05)).toBe(0);
  });

  it('returns 0 with no beats or past the last beat', () => {
    expect(delayToNextBeat(0.2, [])).toBe(0);
    expect(delayToNextBeat(9, beats)).toBe(0);
  });
});


