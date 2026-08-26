import * as THREE from 'three';
import { position as basePosition, tangent as baseTangent } from './spline';
import type { SectionBoundary } from './musicMap';

/**
 * Section-boundary inflection injection for ticket #10.
 *
 * Given the authored base control points and a list of section
 * boundaries, produce an augmented control point list that inserts a
 * new inflection point at each boundary. Catmull-Rom then interpolates
 * smoothly through the augmented list, so the rail bends visibly at
 * each section transition.
 *
 * The function is pure and reads the BASE curve via `basePosition` and
 * `baseTangent` — the call to setControlPoints(augmented) MUST happen
 * AFTER this returns, otherwise the sampled positions would reflect
 * the already-bent curve and the inflection would drift.
 */

const _scratchTan = new THREE.Vector3();
const _scratchRight = new THREE.Vector3();
const _scratchUp = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);

/**
 * Map a parameter t ∈ [0, 1] to the index in the base array that
 * should PRECEDE the inserted inflection. base[0] ↔ t=0; base[N-1] ↔
 * t=1; insertion at index i puts the new point between base[i-1] and
 * base[i].
 */
function indexBefore(baseLength: number, t: number): number {
  const i = Math.round(t * (baseLength - 1));
  return Math.max(0, Math.min(baseLength - 1, i));
}

/**
 * Returns a new augmented control-point array. Insertion order is by
 * boundary startT so the array remains monotonic in t; equal startT
 * values preserve the boundary's input order.
 *
 * Skipped boundaries:
 *   - startT ≤ 0 or startT ≥ 1 (out of curve)
 *   - curvature magnitude < 1e-9 (degenerate / no bend)
 *
 * The returned array is a fresh allocation; the input `base` is not
 * mutated.
 */
export function injectSectionInflections(
  base: readonly THREE.Vector3[],
  boundaries: readonly SectionBoundary[],
): THREE.Vector3[] {
  const augmented: THREE.Vector3[] = [...base];

  const sorted = boundaries
    .filter((b) => b.startT > 0 && b.startT < 1)
    .filter((b) => b.curvature.lengthSq() >= 1e-9)
    .slice()
    .sort((a, b) => a.startT - b.startT);

  // Insert in reverse so splice indices stay valid as the array grows.
  for (let i = sorted.length - 1; i >= 0; i--) {
    const b = sorted[i];
    const anchor = basePosition(b.startT);
    _scratchTan.copy(baseTangent(b.startT));
    _scratchRight.crossVectors(_worldUp, _scratchTan).normalize();
    _scratchUp.crossVectors(_scratchTan, _scratchRight).normalize();
    const inflection = new THREE.Vector3()
      .copy(anchor)
      .addScaledVector(_scratchRight, b.curvature.x)
      .addScaledVector(_scratchUp, b.curvature.y)
      .addScaledVector(_scratchTan, b.curvature.z);
    const idx = indexBefore(base.length, b.startT);
    augmented.splice(idx, 0, inflection);
  }

  return augmented;
}