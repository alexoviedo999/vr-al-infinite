import * as THREE from 'three';

/**
 * Music Map — the seam that the essentia.js pipeline will satisfy in a
 * later ticket. Until then, `MockMusicMap` ships with the prototype
 * so the rail-API extension can be validated end-to-end on desktop.
 *
 * Sections are addressed in normalised parameter t ∈ [0, 1] rather than
 * seconds, so they remain valid when the rail's total arc length changes
 * (via #10 setControlPoints) or when a longer Track is loaded. The
 * Playhead owns the seconds↔t mapping for the audio side; the rail
 * just needs to know "bend here".
 */

/** Named musical section. The five canonical names follow Rez/electronic
 *  music terminology. */
export type SectionName = 'intro' | 'build' | 'drop' | 'breakdown' | 'outro';

/** A section boundary: where to insert an inflection into the rail
 *  (startT) and the curvature applied in the cross-section basis at
 *  that t (right = +x, up = +y, forward = +z along tangent). */
export interface SectionBoundary {
  name: SectionName;
  /** Parameter t ∈ [0, 1] where the section begins. */
  startT: number;
  /** Curvature in the cross-section basis at startT. Magnitudes
   *  should stay within `TUNNEL_RADIUS = 3` to keep orbs inside the
   *  tunnel envelope. */
  curvature: THREE.Vector3;
}

/** Interface implemented by anything that produces section boundaries
 *  for the rail. Real implementations will be backed by essentia.js;
 *  the prototype ships with a hardcoded mock. */
export interface MusicMap {
  sections(): readonly SectionBoundary[];
}

/**
 * Hardcoded MusicMap for the 30-unit prototype rail (#9) and any
 * longer Track until the essentia.js pipeline lands. Section
 * boundaries are spaced roughly into the middle half of the rail so
 * the bend falls inside the tunnel envelope and feels visually
 * distinct from the authored 5-point shape. Each section adds a
 * different axis of "psychedelic lift" — intro drifts +Y gently,
 * build lifts +Y, drop whips +X, breakdown pulls -X back to neutral
 * — which matches the rez-clone pitch ("visuals anticipate musical
 * moments") and the four canonical section names in issue #10.
 *
 * The boundary ordering, names, and curvature are illustrative and
 * will be replaced by essentia-driven values once that pipeline
 * lands (filed as issue #14).
 */
export class MockMusicMap implements MusicMap {
  sections(): readonly SectionBoundary[] {
    return [
      { name: 'intro',     startT: 0.10, curvature: new THREE.Vector3( 0.0,  0.6, 0) },
      { name: 'build',     startT: 0.25, curvature: new THREE.Vector3( 0.0,  1.4, 0) },
      { name: 'drop',      startT: 0.55, curvature: new THREE.Vector3( 1.8, -0.6, 0) },
      { name: 'breakdown', startT: 0.80, curvature: new THREE.Vector3(-1.2,  0.4, 0) },
    ];
  }
}