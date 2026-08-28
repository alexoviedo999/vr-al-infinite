import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { useLockOnStore } from '../state/lockOnStore';
import { getPlayerArcLength } from '../rail/railStore';
import { bindXrSelectFire } from './bindXrSelectFire';

// Module-scope scratch so useFrame stays allocation-free (Quest 3 budget).
const _aim = new THREE.Vector3();

function fireCascade() {
  useLockOnStore.getState().fire(getPlayerArcLength());
}

/**
 * Reads the mouse position, projects it to a world-space aim direction,
 * and ticks the lock-on store every frame. Also recycles orbs that have
 * fallen behind the player (recyclePassed no-ops in fallback mode when
 * no spline is set). Fires the cascade on Space (desktop) or the WebXR
 * primary action (`selectstart` — Quest trigger press).
 *
 * Runs AFTER Avatar in the rail render tree so the camera position is
 * current for the same frame's unproject.
 */
export function AimTracker() {
  const { camera, mouse, gl } = useThree();
  const tick = useLockOnStore((s) => s.tick);

  useFrame((_, dt) => {
    _aim.set(mouse.x, mouse.y, -1);
    _aim.unproject(camera).sub(camera.position).normalize();
    useLockOnStore.getState().recyclePassed(getPlayerArcLength());
    tick(_aim, camera.position, dt, performance.now());
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      fireCascade();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const xr = gl.xr;
    let unbind: (() => void) | undefined;

    const attach = () => {
      unbind?.();
      const session = xr.getSession();
      if (!session) return;
      unbind = bindXrSelectFire(session, fireCascade);
    };

    const detach = () => {
      unbind?.();
      unbind = undefined;
    };

    attach();
    xr.addEventListener('sessionstart', attach);
    xr.addEventListener('sessionend', detach);
    return () => {
      xr.removeEventListener('sessionstart', attach);
      xr.removeEventListener('sessionend', detach);
      detach();
    };
  }, [gl]);

  return null;
}
