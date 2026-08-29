import * as THREE from 'three';
import type { MusicMap, SectionBoundary } from '../rail/musicMap';
import type { SerializedMusicMap } from './sectionFromAnalysis';

/**
 * MusicMap backed by a worker-extracted JSON artifact (#14).
 * `sections()` returns a fresh array each call, matching MockMusicMap.
 */
export class RealMusicMap implements MusicMap {
  constructor(readonly serialized: SerializedMusicMap) {}

  sections(): readonly SectionBoundary[] {
    return this.serialized.sections.map((s) => ({
      name: s.name,
      startT: s.startT,
      velocity: s.velocity,
      curvature: new THREE.Vector3(s.curvature[0], s.curvature[1], s.curvature[2]),
    }));
  }
}
