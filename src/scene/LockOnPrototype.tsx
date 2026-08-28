import * as THREE from 'three';
import { OrbField } from '../orbs/OrbField';
import { AimTracker } from './AimTracker';

/**
 * Lock-on feel prototype for ticket #6.
 *
 * Reads the mouse position to compute an aim direction (mouse → world
 * ray), runs the cone test each frame, renders targets with their
 * lock-progress as colour + scale + a lock ring, and cascades fires
 * when the player presses Space (desktop) or the Quest trigger
 * (`selectstart` via AimTracker).
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
      <OrbField />
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