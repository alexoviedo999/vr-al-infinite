import { useFrame } from '@react-three/fiber';
import { useEffect } from 'react';
import {
  playerPosRef,
  playerTRef,
  tangentRef,
  useRailStore,
} from './railStore';
import {
  arcLength,
  position,
  setControlPoints,
  tangent,
  tFromArcLength,
} from './spline';
import { useLockOnStore } from '../state/lockOnStore';
import { useTuningStore } from '../state/tuningStore';
import { CONTROL_POINTS } from './points';
import { useMusicMapStore } from '../state/musicMapStore';
import { injectSectionInflections } from './sectionInflection';
import { velocityAt } from './sectionVelocity';
import type { SectionBoundary } from './musicMap';

const SPLINE_API = {
  position,
  tangent,
  arcLength,
  tFromArcLength,
};

// Cached section list for the per-frame velocity lookup (#12).
// Rebuilt when the active MusicMap changes (mock → extracted).
let sectionsCache: readonly SectionBoundary[] = useMusicMapStore.getState().map.sections();

/**
 * Drives the rail at section-velocity speed (#12) and publishes the
 * player pose (position + tangent) each frame for downstream consumers
 * (`RailGridFloor`, `AimTracker`, `Avatar`).
 *
 * On mount: builds the active control-point set from CONTROL_POINTS
 * (with section-boundary inflection points injected if the Music Map
 * is enabled in the tuning store), publishes the ISpline to the
 * lock-on store, and starts the rail. On unmount: restores the bare
 * CONTROL_POINTS and clears the lockon spline.
 *
 * When `musicMapEnabled` flips in the tuning store, the rail rebuilds
 * (augmented vs base) and the lockon store is re-published so the
 * `OrbField` Zustand subscriber picks up the new closures.
 *
 * Runs FIRST in the JSX (before TunnelAlongSpline, RailGridFloor,
 * OrbField, Avatar, AimTracker) so the per-frame playerT write wins;
 * R3F runs useFrame callbacks in render-tree order. The camera is no
 * longer written here — `Avatar` owns the camera now (#11).
 */
export function RailMover() {
  useEffect(() => {
    applyRailForMusicMapFlag(useTuningStore.getState().musicMapEnabled);
    useRailStore.getState().start();
    return () => {
      setControlPoints(CONTROL_POINTS);
      useLockOnStore.getState().setSpline(null);
    };
  }, []);

  // Rebuild when the velocity-inflection toggle flips OR a real Music
  // Map replaces the mock (upload finished).
  useEffect(() => {
    const unsubTune = useTuningStore.subscribe((s, prev) => {
      if (s.musicMapEnabled !== prev.musicMapEnabled) {
        applyRailForMusicMapFlag(s.musicMapEnabled);
      }
    });
    const unsubMap = useMusicMapStore.subscribe((s, prev) => {
      if (s.map !== prev.map) {
        sectionsCache = s.map.sections();
        applyRailForMusicMapFlag(useTuningStore.getState().musicMapEnabled);
      }
    });
    return () => {
      unsubTune();
      unsubMap();
    };
  }, []);

  useFrame((_, dt) => {
    const runState = useRailStore.getState().runState;
    if (runState === 'running') {
      const tuning = useTuningStore.getState();
      const baseSpeed = tuning.speed;
      // Section-driven velocity profile (#12): when enabled, the rail
      // moves at baseSpeed × section.velocity while inside each Music
      // Map section. Falls back to baseSpeed when disabled.
      const speed = tuning.velocityProfileEnabled
        ? velocityAt(playerTRef.current, sectionsCache, baseSpeed)
        : baseSpeed;
      const d = arcLength(playerTRef.current) + speed * dt;
      const nextT = tFromArcLength(d);
      if (nextT >= 1) {
        playerTRef.current = 1;
        useRailStore.getState().end();
      } else {
        playerTRef.current = nextT;
      }
    }

    // Resolve the pose regardless of runState so the camera is on-rail
    // from the very first frame, even before start() fires.
    const p = position(playerTRef.current);
    const t = tangent(playerTRef.current);
    playerPosRef.current.copy(p);
    tangentRef.current.copy(t);
  });

  return null;
}

/**
 * Sets the active control points and re-publishes the ISpline to the
 * lockon store. When `enabled` is true, the augmented list (base +
 * section-boundary inflection points) is installed; otherwise the
 * bare authored CONTROL_POINTS are restored. MockMusicMap currently
 * ships with every curvature at zero, so the augmented list is
 * functionally equivalent to the base list — the call is kept so a
 * future essentia-driven MusicMap (#14) can supply real curvatures
 * without touching RailMover. The lockon store's setSpline re-caches
 * totalArcLength and rebuilds initial orb targets — fine for feel
 * debugging; not for live gameplay.
 */
function applyRailForMusicMapFlag(enabled: boolean): void {
  const sections = useMusicMapStore.getState().map.sections();
  sectionsCache = sections;
  const points = enabled
    ? injectSectionInflections(CONTROL_POINTS, sections)
    : CONTROL_POINTS;
  setControlPoints(points);
  useLockOnStore.getState().setSpline(SPLINE_API);
}