import { describe, expect, it } from 'vitest';
import { decodeAiff } from '../audio/decodeAiff';

function writeExt80(view: DataView, offset: number, value: number): void {
  // 44100 as Apple 80-bit: exp=0x400E, mantissa with integer bit.
  if (value === 44100) {
    view.setUint16(offset, 0x400e);
    view.setUint32(offset + 2, 0xac440000);
    view.setUint32(offset + 6, 0);
    return;
  }
  throw new Error('test helper only knows 44100');
}

function makeAiff(frames: number, channels: number, samples: number[]): ArrayBuffer {
  const commSize = 18;
  const ssndData = frames * channels * 2;
  const ssndSize = 8 + ssndData;
  const formSize = 4 + 8 + commSize + 8 + ssndSize;
  const buf = new ArrayBuffer(12 + 8 + commSize + 8 + ssndSize);
  const view = new DataView(buf);
  const enc = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  enc(0, 'FORM');
  view.setUint32(4, formSize);
  enc(8, 'AIFF');
  enc(12, 'COMM');
  view.setUint32(16, commSize);
  view.setInt16(20, channels);
  view.setUint32(22, frames);
  view.setInt16(26, 16);
  writeExt80(view, 28, 44100);
  enc(38, 'SSND');
  view.setUint32(42, ssndSize);
  view.setUint32(46, 0);
  view.setUint32(50, 0);
  let p = 54;
  for (const s of samples) {
    view.setInt16(p, s);
    p += 2;
  }
  return buf;
}

describe('decodeAiff', () => {
  it('mixes 16-bit stereo to mono float', () => {
    const buf = makeAiff(2, 2, [32767, -32768, 0, 0]);
    const decoded = decodeAiff(buf);
    expect(decoded.sampleRate).toBe(44100);
    expect(decoded.samples).toHaveLength(2);
    expect(decoded.samples[0]).toBeCloseTo(0, 3);
    expect(decoded.durationSec).toBeCloseTo(2 / 44100, 8);
  });

  it('rejects non-AIFF buffers', () => {
    expect(() => decodeAiff(new ArrayBuffer(16))).toThrow(/AIFF/);
  });
});
