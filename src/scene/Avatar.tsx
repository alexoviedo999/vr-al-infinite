import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { playerPosRef, tangentRef } from '../rail/railStore';

// Avatar anatomy. Kept as module constants so the geometry reads like
// a proportion card rather than scattered magic numbers.
const LEG_HEIGHT = 0.7; // y: 0 → 0.7
const TORSO_HEIGHT = 0.6; // y: 0.7 → 1.3
const HEAD_Y = 1.5; // head pivot local Y; eyes sit just above this
const HEAD_RADIUS = 0.18;
const ARM_LENGTH = 0.5;
const ARM_SHOULDER_Y = LEG_HEIGHT + 0.5; // ≈ y=1.2, top of torso
const ARM_SHOULDER_X = 0.18; // outer edge of torso
const BODY_COLOR = '#5fd0ff'; // matches lockon rings / debug accents
const TORSO_COLOR = '#1d3a5f'; // muted; matches the tunnel mesh palette

// Desktop chase cam: sit behind/above the figure so the full silhouette
// reads. First-person-from-the-head hid the body (and put tunnel
// octahedra in the player's face). VR still overwrites this via gl.xr.
const CAM_BACK = 2.8;
const CAM_HEIGHT = 1.85;
const LOOK_AHEAD = 5;
const LOOK_HEIGHT = 1.1;

// Scratch + up vectors. Allocated once, never inside useFrame — keeps the
// per-frame path allocation-free (per the Quest 3 perf note in docs/).
const _up = new THREE.Vector3(0, 1, 0);

/**
 * Wireframe bipedal avatar for ticket #11 (option 2 of #1).
 *
 * Group structure:
 *   avatarGroup (root, follows the rail point each frame; face-aligned to rail tangent)
 *     ├── legs, torso, arms (children — symmetric, ride the body rotation)
 *     └── headGroup (at local Y = HEAD_Y; world rotation = camera.quaternion)
 *         └── head icosahedron
 *
 * Per-frame contract:
 *   - Reads `playerPosRef` and `tangentRef` from `railStore` (published by
 *     `RailMover`). Renders BEFORE this in `RailPrototype`, so the refs are
 *     fresh.
 *   - Writes a chase camera (behind/above the figure). In VR, `gl.xr`
 *     overwrites the camera matrices AFTER this useFrame — harmless.
 *
 * Head-tracking math: `headGroup` lives inside `avatarGroup`, so its world
 * rotation is `avatarGroup.quaternion * headGroup.quaternion`. To make the
 * world rotation match `camera.quaternion` we set
 *   `headGroup.quaternion = avatarGroup.quaternion⁻¹ · camera.quaternion`.
 * Without the inverse, the head would inherit the body's rail-tangent
 * rotation on top of the look rotation.
 *
 * Render-tree order matters: this component must mount BEFORE `AimTracker`
 * in `RailPrototype.tsx` so `AimTracker.unproject(...)` reads a camera
 * position that was written this frame.
 */
export function Avatar() {
  const avatarGroupRef = useRef<THREE.Group>(null);
  const headGroupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useFrame(() => {
    const avatarGroup = avatarGroupRef.current;
    const headGroup = headGroupRef.current;
    if (!avatarGroup || !headGroup) return;

    const railP = playerPosRef.current;
    const railT = tangentRef.current;

    // 1. Root follows the rail point and faces the tangent. Body parts are
    //    children of avatarGroup, so they rotate with the body.
    avatarGroup.position.copy(railP);
    if (railT.lengthSq() > 1e-6) {
      avatarGroup.lookAt(
        railP.x + railT.x,
        railP.y + railT.y,
        railP.z + railT.z,
      );
    }

    // 2. Head pivot's WORLD rotation = camera.quaternion. Because headGroup
    //    is a child of avatarGroup, the local quaternion must compensate for
    //    the parent's body rotation.
    headGroup.quaternion
      .copy(avatarGroup.quaternion)
      .invert()
      .multiply(camera.quaternion);

    // 3. Chase cam: behind and above the rail point, looking past the
    //    chest along the tangent so the full biped is in frame.
    camera.position
      .copy(railP)
      .addScaledVector(railT, -CAM_BACK)
      .addScaledVector(_up, CAM_HEIGHT);
    camera.up.copy(_up);
    camera.lookAt(
      railP.x + railT.x * LOOK_AHEAD,
      railP.y + LOOK_HEIGHT,
      railP.z + railT.z * LOOK_AHEAD,
    );
  });

  return (
    <group ref={avatarGroupRef}>
      {/* Legs — two cylinders, default Y-axis aligned, centered at y = LEG_HEIGHT/2 */}
      <mesh position={[-0.1, LEG_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[0.08, 0.08, LEG_HEIGHT, 8]} />
        <meshBasicMaterial color={BODY_COLOR} wireframe />
      </mesh>
      <mesh position={[0.1, LEG_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[0.08, 0.08, LEG_HEIGHT, 8]} />
        <meshBasicMaterial color={BODY_COLOR} wireframe />
      </mesh>

      {/* Torso — wider cylinder, muted color */}
      <mesh position={[0, LEG_HEIGHT + TORSO_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[0.18, 0.18, TORSO_HEIGHT, 12]} />
        <meshBasicMaterial color={TORSO_COLOR} wireframe />
      </mesh>

      {/* Arms — cylinders rotated 90° around Z so they extend along ±X */}
      <mesh
        position={[ARM_SHOULDER_X + ARM_LENGTH / 2, ARM_SHOULDER_Y, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.06, 0.06, ARM_LENGTH, 8]} />
        <meshBasicMaterial color={BODY_COLOR} wireframe />
      </mesh>
      <mesh
        position={[-(ARM_SHOULDER_X + ARM_LENGTH / 2), ARM_SHOULDER_Y, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.06, 0.06, ARM_LENGTH, 8]} />
        <meshBasicMaterial color={BODY_COLOR} wireframe />
      </mesh>

      {/* Head pivot — at local HEAD_Y. The icosahedron is centered on it,
          so the camera (also at this point) sees the wireframe head when
          the player looks down. */}
      <group ref={headGroupRef} position={[0, HEAD_Y, 0]}>
        <mesh>
          <icosahedronGeometry args={[HEAD_RADIUS, 0]} />
          <meshBasicMaterial color={BODY_COLOR} wireframe />
        </mesh>
      </group>
    </group>
  );
}
