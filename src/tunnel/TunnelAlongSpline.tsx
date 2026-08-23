import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { TUNNEL_PIECES, type TunnelGeometrySpec } from './meshes';
import { position, tangent } from '../rail/spline';
import { basisAt } from '../orbs/rollingWindow';

function createGeometry(spec: TunnelGeometrySpec): THREE.BufferGeometry {
  switch (spec.type) {
    case 'torus':
      return new THREE.TorusGeometry(...spec.args);
    case 'octahedron':
      return new THREE.OctahedronGeometry(...spec.args);
    case 'box':
      return new THREE.BoxGeometry(...spec.args);
  }
}

/**
 * Renders the authored tunnel meshes along the spline. Each piece's
 * world transform is recomputed every frame from its anchorT: position
 * comes from the spline point plus the lateral offset (expressed in the
 * cross-section basis), and orientation aligns the piece's forward axis
 * with the spline tangent with a yawOffset for variety.
 *
 * Single useFrame at the parent group level for amortised cost across
 * pieces; meshes are built once via useMemo and disposed on unmount.
 */
export function TunnelAlongSpline() {
  const pieces = useMemo(() => {
    return TUNNEL_PIECES.map((piece) => {
      const geometry = createGeometry(piece.geometry);
      const material = new THREE.MeshBasicMaterial({ color: piece.color, wireframe: true });
      const mesh = new THREE.Mesh(geometry, material);
      return { mesh, piece };
    });
  }, []);

  useEffect(() => {
    return () => {
      pieces.forEach(({ mesh }) => {
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
        else mesh.material.dispose();
      });
    };
  }, [pieces]);

  useFrame(() => {
    for (const { mesh, piece } of pieces) {
      const p = position(piece.anchorT);
      const b = basisAt(piece.anchorT);
      const tan = tangent(piece.anchorT);

      // Position = spline point + cross-section offset.
      mesh.position.set(
        p.x + b.right.x * piece.offset[0] + b.up.x * piece.offset[1] + b.forward.x * piece.offset[2],
        p.y + b.right.y * piece.offset[0] + b.up.y * piece.offset[1] + b.forward.y * piece.offset[2],
        p.z + b.right.z * piece.offset[0] + b.up.z * piece.offset[1] + b.forward.z * piece.offset[2],
      );

      // Orient: face along the tangent with yawOffset rotation.
      mesh.up.set(0, 1, 0);
      mesh.lookAt(
        mesh.position.x + tan.x,
        mesh.position.y + tan.y,
        mesh.position.z + tan.z,
      );
      if (piece.yawOffset !== 0) {
        // Yaw rotates around the local Z axis (which is opposite the
        // tangent after lookAt). Negate yawOffset so positive rotation
        // matches the right-hand rule around the forward direction.
        mesh.rotateZ(-piece.yawOffset);
      }
    }
  });

  return (
    <group>
      {pieces.map(({ mesh }, i) => (
        <primitive key={i} object={mesh} />
      ))}
    </group>
  );
}
