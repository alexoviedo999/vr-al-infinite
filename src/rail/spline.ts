import * as THREE from 'three';
import { CONTROL_POINTS } from './points';

/**
 * Catmull-Rom spline interpolation over the authored control points.
 *
 * Public API:
 *   position(t)        — interpolated world position at parameter t ∈ [0, 1]
 *   tangent(t)         — first derivative, normalized
 *   arcLength(t)       — cumulative arc length at parameter t
 *   tFromArcLength(d)  — inverse of arcLength for constant-velocity advancement
 *
 * The curve is the standard uniform Catmull-Rom (tension 0.5). Five
 * control points → four segments; the start and end segments duplicate
 * the endpoint so position(0) returns the first control point exactly
 * and position(1) returns the last.
 *
 * Arc-length parameterization uses a 256-entry cumulative lookup table
 * built once at module load via the trapezoidal rule on |tangent|.
 * Linear interpolation between table entries keeps the per-frame cost
 * to a single table lookup.
 */

const SEGMENT_COUNT = CONTROL_POINTS.length - 1;
const ARC_TABLE_SIZE = 256;

type Segment = readonly [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3];

const segments: Segment[] = (() => {
  const out: Segment[] = [];
  for (let i = 0; i < SEGMENT_COUNT; i++) {
    if (i === 0) {
      out.push([CONTROL_POINTS[0], CONTROL_POINTS[0], CONTROL_POINTS[1], CONTROL_POINTS[2]]);
    } else if (i === SEGMENT_COUNT - 1) {
      const last = CONTROL_POINTS.length - 1;
      out.push([CONTROL_POINTS[last - 2], CONTROL_POINTS[last - 1], CONTROL_POINTS[last], CONTROL_POINTS[last]]);
    } else {
      out.push([CONTROL_POINTS[i - 1], CONTROL_POINTS[i], CONTROL_POINTS[i + 1], CONTROL_POINTS[i + 2]]);
    }
  }
  return out;
})();

function catmullRom(
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  p3: THREE.Vector3,
  t: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const t2 = t * t;
  const t3 = t2 * t;
  out.set(
    0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
  );
  return out;
}

function catmullRomDerivative(
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  p3: THREE.Vector3,
  t: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const t2 = t * t;
  out.set(
    0.5 * ((-p0.x + p2.x) + 2 * (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t + 3 * (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t2),
    0.5 * ((-p0.y + p2.y) + 2 * (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t + 3 * (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t2),
    0.5 * ((-p0.z + p2.z) + 2 * (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t + 3 * (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t2),
  );
  return out;
}

const _scratchPos = new THREE.Vector3();
const _scratchTan = new THREE.Vector3();

function segmentFor(t: number): { seg: Segment; localT: number } {
  const tScaled = t * SEGMENT_COUNT;
  const i = Math.min(Math.floor(tScaled), SEGMENT_COUNT - 1);
  return { seg: segments[i], localT: tScaled - i };
}

export function position(t: number): THREE.Vector3 {
  const clamped = Math.max(0, Math.min(1, t));
  const { seg, localT } = segmentFor(clamped);
  const [p0, p1, p2, p3] = seg;
  catmullRom(p0, p1, p2, p3, localT, _scratchPos);
  return _scratchPos.clone();
}

export function tangent(t: number): THREE.Vector3 {
  const clamped = Math.max(0, Math.min(1, t));
  const { seg, localT } = segmentFor(clamped);
  const [p0, p1, p2, p3] = seg;
  // Chain rule: dq/dt = dq/d(localT) * SEGMENT_COUNT. The local derivative
  // is scaled by SEGMENT_COUNT so tangent returns the true direction of
  // travel along the overall parameterisation.
  catmullRomDerivative(p0, p1, p2, p3, localT, _scratchTan);
  _scratchTan.multiplyScalar(SEGMENT_COUNT);
  return _scratchTan.normalize();
}

/**
 * |tangent(t)| — speed in world units per unit of the overall parameter t.
 * Used to build the arc-length table at module load.
 */
function speed(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  const { seg, localT } = segmentFor(clamped);
  const [p0, p1, p2, p3] = seg;
  catmullRomDerivative(p0, p1, p2, p3, localT, _scratchTan);
  return _scratchTan.length() * SEGMENT_COUNT;
}

// Cumulative arc-length lookup. ARC_TABLE[i] = arc length at t = i / ARC_TABLE_SIZE.
// Built once via trapezoidal integration of |tangent| over uniform parameter samples.
const ARC_TABLE: number[] = (() => {
  const table = new Array<number>(ARC_TABLE_SIZE + 1);
  table[0] = 0;
  let prevSpeed = speed(0);
  for (let i = 1; i <= ARC_TABLE_SIZE; i++) {
    const t = i / ARC_TABLE_SIZE;
    const curSpeed = speed(t);
    const dt = 1 / ARC_TABLE_SIZE;
    table[i] = table[i - 1] + ((prevSpeed + curSpeed) * dt) / 2;
    prevSpeed = curSpeed;
  }
  return table;
})();

export const TOTAL_ARC_LENGTH = ARC_TABLE[ARC_TABLE_SIZE];

export function arcLength(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  const idx = clamped * ARC_TABLE_SIZE;
  const i = Math.min(Math.floor(idx), ARC_TABLE_SIZE - 1);
  const frac = idx - i;
  return ARC_TABLE[i] + frac * (ARC_TABLE[i + 1] - ARC_TABLE[i]);
}

export function tFromArcLength(d: number): number {
  if (d <= 0) return 0;
  if (d >= TOTAL_ARC_LENGTH) return 1;
  // Binary search: largest i such that ARC_TABLE[i] <= d.
  let lo = 0;
  let hi = ARC_TABLE_SIZE;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (ARC_TABLE[mid] <= d) lo = mid;
    else hi = mid;
  }
  const arcLo = ARC_TABLE[lo];
  const arcHi = ARC_TABLE[hi];
  const tLo = lo / ARC_TABLE_SIZE;
  const tHi = hi / ARC_TABLE_SIZE;
  if (arcHi <= arcLo) return tLo;
  const frac = (d - arcLo) / (arcHi - arcLo);
  return tLo + frac * (tHi - tLo);
}
