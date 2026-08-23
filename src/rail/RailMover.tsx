import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import {
  getSpeed,
  playerPosRef,
  playerTRef,
  tangentRef,
  useRailStore,
} from './railStore';
import {
  arcLength,
  position,
  tangent,
  tFromArcLength,
  TOTAL_ARC_LENGTH,
} from './spline';
import { useLockOnStore } from '../state/lockOnStore';

/**
 * Drives the camera along the authored spline at constant speed.
 *
 * On mount: registers the spline with the lock-on store so its cone
 * test can resolve world positions during tick(). On unmount: clears
 * the spline so the lockon-only prototype path is unaffected when
 * `RAIL_MODE` is flipped off.
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
    useLockOnStore.getState().setSpline({
      position,
      tangent,
      arcLength,
      tFromArcLength,
    });
    return () => {
      useLockOnStore.getState().setSpline(null);
    };
  }, []);

  useFrame((_, dt) => {
    const runState = useRailStore.getState().runState;
    if (runState === 'running') {
      const d = arcLength(playerTRef.current) + getSpeed(playerTRef.current) * dt;
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

// Re-export so consumers can grab TOTAL_ARC_LENGTH from the same module.
export { TOTAL_ARC_LENGTH };
