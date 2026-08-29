import { describe, expect, it } from 'vitest';
import {
  cascadeChordHz,
  midiToHz,
  parseKey,
  rootMidi,
} from '../audio/chimeScale';

describe('parseKey', () => {
  it('maps essentia-style names onto pitch-class + mode', () => {
    expect(parseKey('A', 'minor')).toEqual({ tonicPc: 9, mode: 'minor' });
    expect(parseKey('C#', 'major')).toEqual({ tonicPc: 1, mode: 'major' });
    expect(parseKey('F', 'major')).toEqual({ tonicPc: 5, mode: 'major' });
  });

  it('falls back to A minor on garbage', () => {
    expect(parseKey('nope', 'whatever')).toEqual({ tonicPc: 9, mode: 'minor' });
  });
});

describe('cascadeChordHz', () => {
  it('A minor triad is A3 C4 E4', () => {
    const hz = cascadeChordHz(3, parseKey('A', 'minor'));
    expect(hz).toHaveLength(3);
    expect(hz[0]).toBeCloseTo(midiToHz(57), 1); // A3
    expect(hz[1]).toBeCloseTo(midiToHz(60), 1); // C4
    expect(hz[2]).toBeCloseTo(midiToHz(64), 1); // E4
  });

  it('C major triad is C4 E4 G4', () => {
    const hz = cascadeChordHz(3, parseKey('C', 'major'));
    expect(hz[0]).toBeCloseTo(midiToHz(60), 1);
    expect(hz[1]).toBeCloseTo(midiToHz(64), 1);
    expect(hz[2]).toBeCloseTo(midiToHz(67), 1);
  });

  it('four-note stack adds the seventh (diatonic, not pentatonic)', () => {
    const aMin = cascadeChordHz(4, parseKey('A', 'minor'));
    expect(aMin[3]).toBeCloseTo(midiToHz(67), 1); // G4, b7 of A minor
    const cMaj = cascadeChordHz(4, parseKey('C', 'major'));
    expect(cMaj[3]).toBeCloseTo(midiToHz(71), 1); // B4, major 7
  });

  it('single lock is just the tonic', () => {
    expect(cascadeChordHz(1, parseKey('A', 'minor'))).toHaveLength(1);
    expect(cascadeChordHz(0, parseKey('A', 'minor'))).toEqual([]);
  });
});

describe('rootMidi', () => {
  it('places the tonic near the middle of C3–G4', () => {
    expect(rootMidi(0)).toBe(60); // C4
    expect(rootMidi(9)).toBe(57); // A3
  });
});
