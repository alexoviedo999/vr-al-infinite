import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { TUNNEL_PIECES, type TunnelGeometrySpec } from './meshes';
import { position, tangent } from '../rail/spline';
import { basisAt } from '../orbs/rollingWindow';
import { getRailSections } from '../rail/RailMover';
import { playerTRef } from '../rail/railStore';
import { sectionAt } from '../rail/sectionVelocity';
import { useMusicMapStore } from '../state/musicMapStore';
import { useTuningStore } from '../state/tuningStore';
import { SECTION_NEON } from '../scene/sectionLook';

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
 *
 * Section curvature is applied as a visual-only lateral offset so the
 * rail (and camera) stay smooth. Ring scale pulses on the Beat Grid.
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
    // The first three pieces are the rings; their anchorT is live from
    // the tuning store so the DebugPanel can re-space them. The
    // off-axis pieces (octahedron, box) keep their authored anchorT.
    const ringTs = useTuningStore.getState().ringAnchorTs;
    const store = useMusicMapStore.getState();
    const playerT = playerTRef.current;
    const section = sectionAt(playerT, getRailSections());
    const curv = section?.curvature;
    const neon = SECTION_NEON[section?.name ?? 'intro'];
    const nowSec = playerT * store.durationSec;
    const beats = store.beats;
    let pulse = 1;
    for (let i = beats.length - 1; i >= 0; i--) {
      if (beats[i] <= nowSec) {
        const age = nowSec - beats[i];
        if (age < 0.12) pulse = 1 + (1 - age / 0.12) * 0.06;
        break;
      }
    }

    for (let i = 0; i < pieces.length; i++) {
      const { mesh, piece } = pieces[i];
      const anchorT = i < 3 ? ringTs[i] : piece.anchorT;
      const p = position(anchorT);
      const b = basisAt(anchorT);
      const tan = tangent(anchorT);
      const ox = piece.offset[0] + (curv?.x ?? 0);
      const oy = piece.offset[1] + (curv?.y ?? 0);
      const oz = piece.offset[2] + (curv?.z ?? 0);

      // Position = spline point + authored offset + visual curvature.
      mesh.position.set(
        p.x + b.right.x * ox + b.up.x * oy + b.forward.x * oz,
        p.y + b.right.y * ox + b.up.y * oy + b.forward.y * oz,
        p.z + b.right.z * ox + b.up.z * oy + b.forward.z * oz,
      );
      mesh.scale.setScalar(i < 3 ? pulse : 1);
      const mat = mesh.material;
      if (mat instanceof THREE.MeshBasicMaterial) mat.color.set(neon);

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
