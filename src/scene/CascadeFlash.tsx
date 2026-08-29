import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { playerPosRef, tangentRef } from '../rail/railStore';
import { useLockOnStore } from '../state/lockOnStore';

const FLASH_SEC = 0.35;
const _look = new THREE.Vector3();

/**
 * Kill-flash for the first shooting pass: a wireframe ring that
 * blooms along the rail tangent for ~350ms after a cascade. Matches
 * visual-baseline pillar 5 (starburst must be readable in periphery).
 * All per-frame writes go through refs.
 */
export function CascadeFlash() {
  const meshRef = useRef<THREE.Mesh>(null);
  const lastCascade = useLockOnStore((s) => s.lastCascade);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    if (!lastCascade) {
      mesh.visible = false;
      return;
    }
    const age = (performance.now() - lastCascade.atMs) / 1000;
    if (age >= FLASH_SEC) {
      mesh.visible = false;
      return;
    }
    const t = age / FLASH_SEC;
    const scale = 0.5 + t * (0.8 + lastCascade.ids.length * 0.35);
    mesh.visible = true;
    mesh.scale.setScalar(scale);
    mesh.position.copy(playerPosRef.current).addScaledVector(tangentRef.current, 2.2);
    _look.copy(mesh.position).add(tangentRef.current);
    mesh.lookAt(_look);
    const mat = mesh.material;
    if (mat instanceof THREE.MeshBasicMaterial) {
      mat.opacity = (1 - t) * 0.85;
    }
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <ringGeometry args={[0.55, 0.72, 24]} />
      <meshBasicMaterial color="#5fd0ff" transparent opacity={0} side={THREE.DoubleSide} />
    </mesh>
  );
}
