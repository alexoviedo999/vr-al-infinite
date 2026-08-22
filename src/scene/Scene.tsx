import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';

/**
 * First-pass scene for the bootstrap scaffold.
 *
 * Dual-mode:
 *   - Desktop browser: OrbitControls drive the camera (mouse drag = orbit,
 *     wheel = zoom, right-drag = pan).
 *   - Quest 3 WebXR: OrbitControls are disabled. The XR session drives the
 *     camera; the player's HMD pose is the camera.
 *
 * A static wireframe "hello" composition: grid floor + a few floating
 * wireframe primitives hinting at the eventual tunnel / orb aesthetic.
 */
export function Scene() {
  const isPresenting = useIsPresenting();

  return (
    <>
      <color attach="background" args={['#000005']} />
      <fog attach="fog" args={['#000005', 8, 30]} />

      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={0.6} />

      <HelloWireframes />

      {!isPresenting && (
        <OrbitControls
          makeDefault
          enableDamping
          target={[0, 0, 0]}
          minDistance={2}
          maxDistance={20}
        />
      )}
    </>
  );
}

function HelloWireframes() {
  return (
    <group>
      {/* Grid floor — a cyberspace staple. */}
      <gridHelper args={[40, 40, '#1d3a5f', '#0d1d2e']} position={[0, -2, 0]} />

      {/* Centered wireframe torus knot — the "hello world" of three.js. */}
      <mesh position={[0, 0, 0]}>
        <torusKnotGeometry args={[1, 0.3, 128, 16]} />
        <meshBasicMaterial color="#5fd0ff" wireframe />
      </mesh>

      {/* Four wireframe cubes orbiting at varying depths. */}
      {[
        { p: [-3, 1, -2], s: 0.8, c: '#ff5fa8' },
        { p: [3, -0.5, -1], s: 0.6, c: '#a8ff5f' },
        { p: [-2, -1, -4], s: 0.5, c: '#ffd45f' },
        { p: [2.5, 1.5, -5], s: 0.7, c: '#c45fff' },
      ].map(({ p, s, c }, i) => (
        <mesh key={i} position={p as [number, number, number]} scale={s}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={c} wireframe />
        </mesh>
      ))}

      {/* A wireframe ring on the XZ plane — tunnel stub. */}
      <mesh position={[0, 0, -8]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3, 0.05, 8, 64]} />
        <meshBasicMaterial color="#5fd0ff" wireframe />
      </mesh>
    </group>
  );
}

/**
 * Re-render when XR presentation state flips so OrbitControls unmount inside VR.
 * R3F's `useThree` selectors do not subscribe to xr.isPresenting changes, so
 * we listen to the manager's sessionstart / sessionend events explicitly.
 */
function useIsPresenting(): boolean {
  const xr = useThree((s) => s.gl.xr);
  const [isPresenting, setIsPresenting] = useState(xr.isPresenting);

  useEffect(() => {
    const onStart = () => setIsPresenting(true);
    const onEnd = () => setIsPresenting(false);
    xr.addEventListener('sessionstart', onStart);
    xr.addEventListener('sessionend', onEnd);
    return () => {
      xr.removeEventListener('sessionstart', onStart);
      xr.removeEventListener('sessionend', onEnd);
    };
  }, [xr]);

  return isPresenting;
}
