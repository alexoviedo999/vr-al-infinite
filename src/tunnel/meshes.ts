import * as THREE from 'three';

/**
 * Authored tunnel pieces for ticket #9. Each piece sits at a fixed
 * parameter on the spline (anchorT), gets a lateral offset in the
 * cross-section plane, and faces along the tangent with a yawOffset
 * for visual variety.
 *
 * First-cut set: three wireframe rings (matching the existing
 * LockOnPrototype aesthetic) plus two off-axis primitives (octahedron
 * and box) to break the symmetry.
 */

export type TunnelGeometrySpec =
  | { type: 'torus'; args: ConstructorParameters<typeof THREE.TorusGeometry> }
  | { type: 'octahedron'; args: ConstructorParameters<typeof THREE.OctahedronGeometry> }
  | { type: 'box'; args: ConstructorParameters<typeof THREE.BoxGeometry> };

export interface TunnelPiece {
  /** Parameter on the spline (0..1) where the piece sits. */
  anchorT: number;
  /** Lateral offset (right, up, along-tangent) in world units. */
  offset: [number, number, number];
  /** Rotation around the local forward axis for visual variety. */
  yawOffset: number;
  geometry: TunnelGeometrySpec;
  color: string;
}

export const TUNNEL_PIECES: TunnelPiece[] = [
  // Three rings spread along the rail.
  { anchorT: 0.10, offset: [0, 0, 0], yawOffset: 0, geometry: { type: 'torus', args: [3, 0.04, 8, 64] }, color: '#5fd0ff' },
  { anchorT: 0.40, offset: [0, 0, 0], yawOffset: 0, geometry: { type: 'torus', args: [3, 0.04, 8, 64] }, color: '#5fd0ff' },
  { anchorT: 0.75, offset: [0, 0, 0], yawOffset: 0, geometry: { type: 'torus', args: [3, 0.04, 8, 64] }, color: '#5fd0ff' },
  // An octahedron mid-rail, off-axis.
  { anchorT: 0.55, offset: [0.8, 0.4, 0], yawOffset: Math.PI / 4, geometry: { type: 'octahedron', args: [0.8, 0] }, color: '#ff5fa8' },
  // A box at the quarter point.
  { anchorT: 0.25, offset: [-0.6, 0.6, 0], yawOffset: Math.PI / 6, geometry: { type: 'box', args: [1.2, 1.2, 1.2] }, color: '#a8ff5f' },
];
