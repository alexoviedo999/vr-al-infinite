import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import {
  useLockOnStore,
  worldPosOf,
  type LockOnTarget,
} from '../state/lockOnStore';

/**
 * Lock-on feel prototype for ticket #6.
 *
 * Reads the mouse position to compute an aim direction (mouse → world
 * ray), runs the cone test each frame, renders targets with their
 * lock-progress as colour + scale + a lock ring, and cascades fires
 * when the player presses Space (desktop). VR trigger wiring is left
 * for a later ticket — the prototype's "feel" can be evaluated on
 * desktop alone.
 *
 * Replaces the bootstrap "hello" Scene in App.tsx while this ticket
 * is open; the bootstrap scene stays in source for reference.
 */
export function LockOnPrototype() {
  return (
    <>
      <color attach="background" args={['#000005']} />
      <fog attach="fog" args={['#000005', 6, 30]} />

      <ambientLight intensity={0.45} />
      <pointLight position={[0, 0, -3]} intensity={1.2} color="#5fd0ff" />

      <TunnelStub />
      <TargetsAndRings />
      <AimTracker />
    </>
  );
}

function TunnelStub() {
  // The "tunnel" is a long wireframe cylinder seen from the inside.
  // Two rings for parallax + a vanishing-point grid floor.
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[3, 3, 40, 24, 1, true]} />
        <meshBasicMaterial color="#1d3a5f" wireframe side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, -8]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3, 0.04, 8, 64]} />
        <meshBasicMaterial color="#5fd0ff" wireframe />
      </mesh>
      <mesh position={[0, 0, -16]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3, 0.04, 8, 64]} />
        <meshBasicMaterial color="#5fd0ff" wireframe />
      </mesh>
      <gridHelper args={[60, 30, '#0d1d2e', '#0d1d2e']} position={[0, -2, -14]} />
    </group>
  );
}

function TargetsAndRings() {
  const targets = useLockOnStore((s) => s.targets);
  return (
    <>
      {targets.map((t) => (
        <TargetWithRing key={t.id} target={t} />
      ))}
    </>
  );
}

function TargetWithRing({ target }: { target: LockOnTarget }) {
  const lockProgress = target.lockProgress;
  const color = !target.alive
    ? '#ff5f7f'
    : lockProgress > 0
    ? '#5fd0ff'
    : '#7a8a9a';
  const scale = target.alive ? 1 + lockProgress * 0.35 : 1;
  const ringOpacity = lockProgress;

  // LockOnPrototype never sets a spline on the store, so worldPosOf's
  // fallback (offset-as-position) yields the world position. Pass a
  // no-op basis + position so the helper short-circuits.
  const position = worldPosOf(
    target,
    () => ({ right: ZERO, up: ZERO, forward: ZERO }),
    () => ZERO,
  );

  return (
    <group position={position}>
      <mesh scale={scale}>
        <octahedronGeometry args={[0.4, 0]} />
        <meshBasicMaterial color={color} wireframe />
      </mesh>
      {target.alive && ringOpacity > 0 && (
        <mesh>
          <ringGeometry args={[0.55, 0.6, 32]} />
          <meshBasicMaterial
            color="#5fd0ff"
            transparent
            opacity={ringOpacity}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}

const ZERO = new THREE.Vector3();

/**
 * Reads the mouse position, converts it to a world-space aim direction,
 * ticks the lock-on store every frame, and listens for the Space key to
 * fire. The store handles the cascade stagger internally.
 */
function AimTracker() {
  const { camera, mouse } = useThree();
  const tick = useLockOnStore((s) => s.tick);

  useFrame((_, dt) => {
    const aim = new THREE.Vector3(mouse.x, mouse.y, -1);
    aim.unproject(camera).sub(camera.position).normalize();
    tick(aim, camera.position, dt, performance.now());
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      useLockOnStore.getState().fire(0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return null;
}
