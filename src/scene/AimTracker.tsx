import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { useLockOnStore } from '../state/lockOnStore';
import { getPlayerArcLength } from '../rail/railStore';

/**
 * Reads the mouse position, projects it to a world-space aim direction,
 * and ticks the lock-on store every frame. Also recycles orbs that have
 * fallen behind the player (recyclePassed no-ops in fallback mode when
 * no spline is set), and listens for Space to fire.
 *
 * Runs AFTER RailMover in the render tree so the player arc length is
 * current for the same frame's tick.
 */
export function AimTracker() {
  const { camera, mouse } = useThree();
  const tick = useLockOnStore((s) => s.tick);

  useFrame((_, dt) => {
    const aim = new THREE.Vector3(mouse.x, mouse.y, -1);
    aim.unproject(camera).sub(camera.position).normalize();
    useLockOnStore.getState().recyclePassed(getPlayerArcLength());
    tick(aim, camera.position, dt, performance.now());
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      useLockOnStore.getState().fire(getPlayerArcLength());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return null;
}