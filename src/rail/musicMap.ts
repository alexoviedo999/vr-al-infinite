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
 *  (startT), the curvature applied in the cross-section basis at
 *  that t (right = +x, up = +y, forward = +z along tangent), and the
 *  velocity multiplier that scales the rail's base speed while the
 *  player is inside this section (startT ≤ t < next section's startT). */
export interface SectionBoundary {
  name: SectionName;
  /** Parameter t ∈ [0, 1] where the section begins. */
  startT: number;
  /** Curvature in the cross-section basis at startT. Magnitudes
   *  should stay within `TUNNEL_RADIUS = 3` to keep orbs inside the
   *  tunnel envelope. */
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
 * the bend falls inside the tunnel envelope and feels visually
 * distinct from the authored 5-point shape.
 *
 * Each boundary sits BETWEEN two base control points (not on top of
 * one) — the base spline has 5 control points at t = {0, 0.25, 0.5,
 * 0.75, 1}, so boundaries at 0.10 / 0.30 / 0.55 / 0.80 all land in
 * a clear segment. An inflection that coincides with a base control
 * point creates a C1 knot wobble in the Catmull-Rom (two close knots
 * with different tangent directions), which reads as a small back-
 * and-forth jerk on the rail even at low magnitudes.
 *
 * Curvature magnitudes are very small — order 0.05–0.15 units in a
 * tunnel of radius 3 — and the DebugPanel `sectionCurvatureScale`
 * slider runs 0 → 0.15 with 0.005 steps so the user can dial the
 * effective offsets in the 0–0.023 range. At RAIL_SPEED = 2.5 u/s
 * the effect should read as subtle motion parallax / perspective
 * shift, not as a roller-coaster bend. The slider's upper bound is
 * the practical max; anything beyond it reads as a wobble even at
 * the existing section curvatures.
 *
 * Each section adds a different axis of "psychedelic lift" matching
 * the rez-clone pitch and the canonical section names in issue #10.
 * Only sections that sit in regions where their offset *aligns* with
 * the natural base curve are injected — adding an extra Catmull-Rom
 * knot in a region of strong natural curvature creates a tangent-
 * direction twist at the neighbouring knots, which reads as a small
 * jerk in the cabin motion regardless of magnitude. Intro, drop,
 * and breakdown all align; build would not (the natural curve rises
 * through t∈[0.25, 0.5] from y=0.4 to y=0.8, so a +Y inflection there
 * fights the rise), so it is omitted from the mock. The `build`
 * SectionName is still part of the type so a real essentia-driven
 * MusicMap can supply one when its track analysis warrants it.
 *
 *   - intro     — gentle +Y drift, anticipation
 *   - drop      — +X lateral whip, the explosive moment
 *   - breakdown — -X pull back to neutral, relaxation
 *
 * Velocity profile (#12): each section also carries a multiplier
 * that scales the rail's base speed while the player is inside it.
 * Rez-style — intro is slow (anticipation), drop is fastest (the
 * rush), breakdown is medium (exhale). Step-function transitions:
 * the multiplier snaps to the next section's value at its startT.
 * Default base speed is 2.5 u/s, so the effective speeds are 1.5
 * (intro), 3.5 (drop), 2.0 (breakdown).
 *
 * The boundary ordering, names, and curvature are illustrative and
 * will be replaced by essentia-driven values once that pipeline
 * lands (filed as issue #14).
 */
export class MockMusicMap implements MusicMap {
  sections(): readonly SectionBoundary[] {
    return [
      { name: 'intro',     startT: 0.10, curvature: new THREE.Vector3( 0.0,  0.05, 0), velocity: 0.6 },
      { name: 'drop',      startT: 0.55, curvature: new THREE.Vector3( 0.15, -0.05, 0), velocity: 1.4 },
      { name: 'breakdown', startT: 0.80, curvature: new THREE.Vector3(-0.10,  0.04, 0), velocity: 0.8 },
    ];
  }
}