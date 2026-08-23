import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { playerPosRef } from '../rail/railStore';

/**
 * Vanishing-point grid floor that scrolls with the player. Sized large
 * enough that the horizon stays roughly stable as the camera moves; the
 * player is offset 14 units in -forward so the grid covers the visible
 * floor area without a visible edge.
 *
 * Visual reference: the LockOnPrototype TunnelStub aesthetic — soft
 * dim blue grid that gives the rail mode scene structure when the
 * tunnel rings are sparse.
 */
const GRID_COLOR = '#0d1d2e';

export function RailGridFloor() {
  const ref = useRef<THREE.GridHelper>(null);

  useFrame(() => {
    const grid = ref.current;
    if (!grid) return;
    grid.position.x = playerPosRef.current.x;
    grid.position.z = playerPosRef.current.z - 14;
  });

  return (
    <gridHelper
      ref={ref}
      args={[60, 30, GRID_COLOR, GRID_COLOR]}
      position={[0, -2, 0]}
    />
  );
}