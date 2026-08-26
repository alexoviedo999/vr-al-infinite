import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
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

const SPLINE_API = {
  position,
  tangent,
  arcLength,
  tFromArcLength,
};

/**
 * Drives the camera along the rail spline at constant speed.
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
 * Runs FIRST in the JSX (before TunnelAlongSpline, OrbField, AimTracker)
 * so the per-frame playerT write wins; R3F runs useFrame callbacks in
 * render-tree order. The camera write is harmless during a VR session
 * — R3F's XR pipeline replaces it before render — but it's the source
 * of truth on desktop.
 */
export function RailMover() {
  const { camera } = useThree();
  const _up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useEffect(() => {
    applyRailForMusicMapFlag(useTuningStore.getState().musicMapEnabled);
    useRailStore.getState().start();
    return () => {
      setControlPoints(CONTROL_POINTS);
      useLockOnStore.getState().setSpline(null);
    };
  }, []);

  // React to the music-map-enabled toggle AND the curvature-scale
  // slider. Each rebuild re-publishes the ISpline so the lockon
  // store's `spline` selector picks up the new closures (Zustand
  // re-renders subscribers only on reference change, which the
  // fresh object literal guarantees).
  useEffect(() => {
    const unsub = useTuningStore.subscribe((s, prev) => {
      if (
        s.musicMapEnabled !== prev.musicMapEnabled ||
        s.sectionCurvatureScale !== prev.sectionCurvatureScale
      ) {
        applyRailForMusicMapFlag(s.musicMapEnabled);
      }
    });
    return unsub;
  }, []);

  useFrame((_, dt) => {
    const runState = useRailStore.getState().runState;
    if (runState === 'running') {
      const d = arcLength(playerTRef.current) + useTuningStore.getState().speed * dt;
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

    camera.position.copy(p);
    camera.up.copy(_up);
    camera.lookAt(p.x + t.x, p.y + t.y, p.z + t.z);
  });

  return null;
}

/**
 * Sets the active control points and re-publishes the ISpline to the
 * lockon store. When `enabled` is true, the augmented list (base +
 * section-boundary inflection points) is installed, scaled by the
 * current `sectionCurvatureScale` from the tuning store; otherwise
 * the bare authored CONTROL_POINTS are restored. The lockon store's
 * setSpline re-caches totalArcLength and rebuilds initial orb
 * targets — fine for feel debugging; not for live gameplay.
 */
function applyRailForMusicMapFlag(enabled: boolean): void {
  const tuning = useTuningStore.getState();
  const points = enabled
    ? injectSectionInflections(
        CONTROL_POINTS,
        new MockMusicMap().sections(),
        tuning.sectionCurvatureScale,
      )
    : CONTROL_POINTS;
  setControlPoints(points);
  useLockOnStore.getState().setSpline(SPLINE_API);
}