import * as THREE from 'three';

/**
 * Music Map - the seam that the essentia.js pipeline will satisfy in a
 * later ticket. Until then, `MockMusicMap` ships with the prototype
 * so the rail-API extension can be validated end-to-end on desktop.
 *
 * Sections are addressed in normalised parameter t in [0, 1] rather than
 * seconds, so they remain valid when the rail's total arc length changes
 * (via #10 setControlPoints) or when a longer Track is loaded. The
 * Playhead owns the seconds-to-t mapping for the audio side; the rail
 * just needs to know "bend here".
 */

/** Named musical section. The five canonical names follow Rez/electronic
 *  music terminology. */
export type SectionName = 'intro' | 'build' | 'drop' | 'breakdown' | 'outro';

/** A section boundary: where to insert an inflection into the rail
 *  (startT), the curvature applied in the cross-section basis at
 *  that t (right = +x, up = +y, forward = +z along tangent), and the
 *  velocity multiplier that scales the rail's base speed while the
 *  player is inside this section (startT <= t < next section's startT). */
export interface SectionBoundary {
  name: SectionName;
  /** Parameter t in [0, 1] where the section begins. */
  startT: number;
  /** Curvature in the cross-section basis at startT. Magnitudes
   *  should stay within `TUNNEL_RADIUS = 3` to keep orbs inside the
   *  tunnel envelope. Zero is a valid value: sectionInflection.ts
   *  filters out zero-magnitude boundaries, so an entry with
   *  curvature = (0,0,0) does not add a knot to the spline. */
  curvature: THREE.Vector3;
  /** Velocity multiplier applied while inside this section. 1.0 is
   *  the base speed; 0.6 = 60% of base, 1.4 = 140% of base. */
  velocity: number;
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
 * velocity transitions fall inside the tunnel envelope.
 *
 * MockMusicMap ships with every curvature vector set to zero. The
 * Catmull-Rom knot wobble at any extra control point is structural
 * (it twists tangent direction at neighbouring knots, which the body
 * reads as a jerk regardless of magnitude). The user iterated on
 * values for several rounds and reported the rail still felt like a
 * roller coaster at any non-zero curvature, so the prototype ships
 * curvature-free.
 *
 * The `curvature` field is still part of `SectionBoundary` so a real
 * essentia-driven MusicMap (or a future non-Catmull-Rom spline) can
 * supply non-zero values later. The seam stays; only MockMusicMap's
 * payloads are empty for now.
 *
 *   - intro     - slow (anticipation)
 *   - drop      - fastest (the rush)
 *   - breakdown - medium (exhale)
 *
 * Velocity profile (#12): each section carries a multiplier that
 * scales the rail's base speed while the player is inside it.
 * Rez-style - intro is slow, drop is fastest, breakdown is medium.
 * Step-function transitions: the multiplier snaps to the next
 * section's value at its startT. Default base speed is 2.5 u/s, so
 * the effective speeds are 1.5 (intro), 3.5 (drop), 2.0 (breakdown).
 *
 * The boundary ordering, names, and velocities are illustrative and
 * will be replaced by essentia-driven values once that pipeline
 * lands (filed as issue #14).
 */
export class MockMusicMap implements MusicMap {
  sections(): readonly SectionBoundary[] {
    return [
      { name: 'intro',     startT: 0.10, curvature: new THREE.Vector3(0, 0, 0), velocity: 0.6 },
      { name: 'drop',      startT: 0.55, curvature: new THREE.Vector3(0, 0, 0), velocity: 1.4 },
      { name: 'breakdown', startT: 0.80, curvature: new THREE.Vector3(0, 0, 0), velocity: 0.8 },
    ];
  }
}