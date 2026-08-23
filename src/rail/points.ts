import * as THREE from 'three';

/**
 * Authored control points for the forward rail prototype (#9).
 * Five points spaced ~6 units apart along -Z with mild x/y offsets —
 * enough curvature to read as motion, mild enough that the Catmull-Rom
 * doesn't loop. The rail lives entirely in z ∈ [0, -30], inside the
 * tunnel mesh envelope.
 *
 * #10 (Music Map) reshapes the curve at section boundaries via a
 * setSpline() handoff; this file stays static for the prototype.
 */
export const CONTROL_POINTS: readonly THREE.Vector3[] = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(1.2, 0.4, -6),
  new THREE.Vector3(-0.8, 0.8, -14),
  new THREE.Vector3(0.6, -0.5, -22),
  new THREE.Vector3(0, 0, -30),
];
