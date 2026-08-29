/**
 * PCM AIFF decoder. Chrome's decodeAudioData does not handle AIFF
 * (the demo tracks are 16-bit stereo AIFF). Big-endian 16/24/32-bit
 * uncompressed COMM+SSND only — no AIFC compression.
 */

export interface DecodedPcm {
  samples: Float32Array;
  sampleRate: number;
  durationSec: number;
}

export function decodeAiff(buffer: ArrayBuffer): DecodedPcm {
  const view = new DataView(buffer);
  if (ascii(view, 0, 4) !== 'FORM' || ascii(view, 8, 4) !== 'AIFF') {
    throw new Error('not an uncompressed AIFF');
  }
  let offset = 12;
  let channels = 0;
  let frames = 0;
  let bits = 0;
  let sampleRate = 44100;
  let ssnd = 0;
  let ssndSize = 0;

  while (offset + 8 <= view.byteLength) {
    const id = ascii(view, offset, 4);
    const size = view.getUint32(offset + 4);
    const data = offset + 8;
    if (id === 'COMM' && size >= 18) {
      channels = view.getInt16(data);
      frames = view.getUint32(data + 2);
      bits = view.getInt16(data + 6);
      sampleRate = ieee80(view, data + 8);
    } else if (id === 'SSND') {
      const dataOffset = view.getUint32(data);
      ssnd = data + 8 + dataOffset;
      ssndSize = size - 8 - dataOffset;
    }
    offset = data + size + (size % 2);
  }

  if (!channels || !frames || !ssnd) throw new Error('AIFF missing COMM/SSND');
  if (bits !== 16 && bits !== 24 && bits !== 32) {
    throw new Error(`unsupported AIFF bit depth ${bits}`);
  }

  const bytesPerSample = bits / 8;
  const frameBytes = bytesPerSample * channels;
  const available = Math.floor(ssndSize / frameBytes);
  const n = Math.min(frames, available);
  const samples = new Float32Array(n);
  const scale = bits === 16 ? 32768 : bits === 24 ? 8388608 : 2147483648;

  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let c = 0; c < channels; c++) {
      const p = ssnd + i * frameBytes + c * bytesPerSample;
      acc += readPcm(view, p, bits) / scale;
    }
    samples[i] = acc / channels;
  }

  return { samples, sampleRate, durationSec: n / sampleRate };
}

function ascii(view: DataView, offset: number, n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}

function readPcm(view: DataView, offset: number, bits: number): number {
  if (bits === 16) return view.getInt16(offset);
  if (bits === 32) return view.getInt32(offset);
  const b0 = view.getUint8(offset);
  const b1 = view.getUint8(offset + 1);
  const b2 = view.getUint8(offset + 2);
  let v = (b0 << 16) | (b1 << 8) | b2;
  if (v & 0x800000) v -= 0x1000000;
  return v;
}

/** Apple 80-bit IEEE extended → JS number. */
function ieee80(view: DataView, offset: number): number {
  const exp = view.getUint16(offset);
  const hi = view.getUint32(offset + 2);
  const lo = view.getUint32(offset + 6);
  const sign = exp & 0x8000 ? -1 : 1;
  const exponent = (exp & 0x7fff) - 16383;
  const mantissa = hi / 0x80000000 + lo / 0x80000000 / 0x100000000;
  return sign * mantissa * 2 ** exponent;
}
