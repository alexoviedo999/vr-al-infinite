import * as THREE from 'three';
import type { MusicalKey } from '../audio/chimeScale';
import { DEFAULT_KEY } from '../audio/chimeScale';

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
  /** Beat timestamps in seconds from track start. Empty if unknown. */
  beats(): readonly number[];
  /** Track length in seconds; used to map rail t → playhead. */
  durationSec(): number;
  /** Estimated key for diatonic Chimes. */
  key(): MusicalKey;
}

/**
 * Hardcoded MusicMap for the 30-unit prototype rail (#9) and any
 * longer Track until the essentia.js pipeline lands. Section
 * boundaries are spaced roughly into the middle half of the rail so
 * velocity transitions fall inside the tunnel envelope.
 *
 * Curvature is non-zero and consumed as a *visual-only* lateral offset
 * on tunnel meshes. It is not injected into the Catmull-Rom: extra
 * knots jerk the camera (iterated to zero during #10). The rail stays
 * smooth; the tunnel bends around it.
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
      { name: 'intro',     startT: 0.10, curvature: new THREE.Vector3(0.4, 0.1, 0), velocity: 0.6 },
      { name: 'drop',      startT: 0.55, curvature: new THREE.Vector3(-0.9, 0.25, 0), velocity: 1.4 },
      { name: 'breakdown', startT: 0.80, curvature: new THREE.Vector3(0.55, -0.15, 0), velocity: 0.8 },
    ];
  }

  beats(): readonly number[] {
    const bpm = 120;
    const duration = this.durationSec();
    const step = 60 / bpm;
    const ticks: number[] = [];
    for (let t = 0; t < duration; t += step) ticks.push(t);
    return ticks;
  }

  durationSec(): number {
    return 60;
  }

  key(): MusicalKey {
    return { ...DEFAULT_KEY };
  }
}