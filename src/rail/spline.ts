import * as THREE from 'three';
import { CONTROL_POINTS } from './points';

/**
 * Catmull-Rom spline interpolation over a mutable control-point list.
 *
 * Public API:
 *   setControlPoints(points) — rebuild the segments + arc-length LUT
 *   position(t)              — interpolated world position at parameter t ∈ [0, 1]
 *   tangent(t)               — first derivative, normalized
 *   arcLength(t)             — cumulative arc length at parameter t
 *   tFromArcLength(d)        — inverse of arcLength for constant-velocity advancement
 *   getTotalArcLength()      — cumulative arc length of the active curve
 *
 * The curve is the standard uniform Catmull-Rom (tension 0.5). The
 * module is initialised from CONTROL_POINTS at import time; `setControlPoints`
 * mutates the segments + LUT in place so the same exported functions pick up
 * the new geometry on the next call. This is the seam #10 (Music Map)
 * uses to inject section-boundary inflection points.
 *
 * Arc-length parameterization uses a 256-entry cumulative lookup table
 * built once per control-point set via the trapezoidal rule on |tangent|.
 */

type Segment = readonly [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3];

const ARC_TABLE_SIZE = 256;
const MIN_CONTROL_POINTS = 4;

function buildSegments(points: readonly THREE.Vector3[]): Segment[] {
  const segmentCount = points.length - 1;
  const out: Segment[] = [];
  for (let i = 0; i < segmentCount; i++) {
    if (i === 0) {
      out.push([points[0], points[0], points[1], points[2]]);
    } else if (i === segmentCount - 1) {
      const last = points.length - 1;
      out.push([points[last - 2], points[last - 1], points[last], points[last]]);
    } else {
      out.push([points[i - 1], points[i], points[i + 1], points[i + 2]]);
    }
  }
  return out;
}

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

// Mutable closure state. Rebuilt by setControlPoints.
let segments: Segment[] = buildSegments(CONTROL_POINTS);
let segmentCount = segments.length;

const _scratchPos = new THREE.Vector3();
const _scratchTan = new THREE.Vector3();

function segmentFor(t: number): { seg: Segment; localT: number } {
  const tScaled = t * segmentCount;
  const i = Math.min(Math.floor(tScaled), segmentCount - 1);
  return { seg: segments[i], localT: tScaled - i };
}

function speed(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  const { seg, localT } = segmentFor(clamped);
  const [p0, p1, p2, p3] = seg;
  catmullRomDerivative(p0, p1, p2, p3, localT, _scratchTan);
  return _scratchTan.length() * segmentCount;
}

// Cumulative arc-length lookup. arcTable[i] = arc length at t = i / ARC_TABLE_SIZE.
// Built per control-point set via trapezoidal integration of |tangent| over uniform samples.
function buildArcTable(): number[] {
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
}

let arcTable: number[] = buildArcTable();
let totalArcLength: number = arcTable[ARC_TABLE_SIZE];

/**
 * Replace the active control-point set. Rebuilds the Catmull-Rom
 * segments and the arc-length lookup table. The exported `position`,
 * `tangent`, `arcLength`, `tFromArcLength`, and `getTotalArcLength`
 * functions continue to work and reflect the new geometry on the
 * next call. Cheap enough to call on mount or when the music map
 * changes; NOT per-frame.
 */
export function setControlPoints(points: readonly THREE.Vector3[]): void {
  if (points.length < MIN_CONTROL_POINTS) {
    throw new Error(
      `setControlPoints requires at least ${MIN_CONTROL_POINTS} control points for Catmull-Rom (got ${points.length})`,
    );
  }
  segments = buildSegments(points);
  segmentCount = segments.length;
  arcTable = buildArcTable();
  totalArcLength = arcTable[ARC_TABLE_SIZE];
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
  // Chain rule: dq/dt = dq/d(localT) * segmentCount. The local derivative
  // is scaled by segmentCount so tangent returns the true direction of
  // travel along the overall parameterisation.
  catmullRomDerivative(p0, p1, p2, p3, localT, _scratchTan);
  _scratchTan.multiplyScalar(segmentCount);
  return _scratchTan.normalize();
}

export function arcLength(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  const idx = clamped * ARC_TABLE_SIZE;
  const i = Math.min(Math.floor(idx), ARC_TABLE_SIZE - 1);
  const frac = idx - i;
  return arcTable[i] + frac * (arcTable[i + 1] - arcTable[i]);
}

export function tFromArcLength(d: number): number {
  if (d <= 0) return 0;
  if (d >= totalArcLength) return 1;
  // Binary search: largest i such that arcTable[i] <= d.
  let lo = 0;
  let hi = ARC_TABLE_SIZE;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (arcTable[mid] <= d) lo = mid;
    else hi = mid;
  }
  const arcLo = arcTable[lo];
  const arcHi = arcTable[hi];
  const tLo = lo / ARC_TABLE_SIZE;
  const tHi = hi / ARC_TABLE_SIZE;
  if (arcHi <= arcLo) return tLo;
  const frac = (d - arcLo) / (arcHi - arcLo);
  return tLo + frac * (tHi - tLo);
}

export function getTotalArcLength(): number {
  return totalArcLength;
}