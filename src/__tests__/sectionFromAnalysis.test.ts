import { describe, expect, it } from 'vitest';
import {
  chimeFrequency,
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
    expect(drop?.curvature).toEqual([0, 0, 0]);
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

describe('chimeFrequency', () => {
  it('walks a pentatonic ladder and wraps', () => {
    expect(chimeFrequency(0)).toBe(220);
    expect(chimeFrequency(5)).toBe(440);
    expect(chimeFrequency(8)).toBe(chimeFrequency(0));
  });
});
