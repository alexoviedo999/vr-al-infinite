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
import { MockMusicMap } from './musicMap';
import { injectSectionInflections } from './sectionInflection';
import { velocityAt } from './sectionVelocity';

const SPLINE_API = {
  position,
  tangent,
  arcLength,
  tFromArcLength,
};

// Cached section list for the per-frame velocity lookup (#12).
// MockMusicMap.sections() returns a fresh array each call (the test
// asserts this), but the rail doesn't mutate it, so caching a single
// reference here is safe and avoids per-frame allocation.
const SECTIONS = new MockMusicMap().sections();

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

  // React to the music-map-enabled toggle. Each rebuild re-publishes
  // the ISpline so the lockon store's `spline` selector picks up the
  // new closures (Zustand re-renders subscribers only on reference
  // change, which the fresh object literal guarantees).
  useEffect(() => {
    const unsub = useTuningStore.subscribe((s, prev) => {
      if (s.musicMapEnabled !== prev.musicMapEnabled) {
        applyRailForMusicMapFlag(s.musicMapEnabled);
      }
    });
    return unsub;
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
        ? velocityAt(playerTRef.current, SECTIONS, baseSpeed)
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
  const points = enabled
    ? injectSectionInflections(
        CONTROL_POINTS,
        new MockMusicMap().sections(),
      )
    : CONTROL_POINTS;
  setControlPoints(points);
  useLockOnStore.getState().setSpline(SPLINE_API);
}