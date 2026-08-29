import { OrbField } from '../orbs/OrbField';
import { RailMover } from '../rail/RailMover';
import { TunnelAlongSpline } from '../tunnel/TunnelAlongSpline';
import { AimTracker } from './AimTracker';
import { Avatar } from './Avatar';
import { CascadeFlash } from './CascadeFlash';
import { RailGridFloor } from './RailGridFloor';
import { useTuningStore } from '../state/tuningStore';

/**
 * Forward-rail motion prototype for ticket #9, with the avatar rig
 * from ticket #11.
 *
 * Render order matters: R3F runs useFrame callbacks in render-tree
 * order, so the components here are mounted in the order they need
 * to run each frame:
 *
 *   1. RailMover        — writes playerPosRef + tangentRef
 *   2. TunnelAlongSpline — reads ring anchors, places tunnel meshes
 *   3. RailGridFloor    — reads playerPosRef.{x,z}, places grid
 *   4. OrbField         — pure JSX, no useFrame
 *   5. Avatar           — reads playerPosRef + tangentRef, writes camera
 *   6. AimTracker       — reads camera (fresh from Avatar) for mouse ray
 *
 * Mounting Avatar before AimTracker guarantees AimTracker reads a
 * camera position that was written this frame. In VR, gl.xr replaces
 * the camera matrices in the render pipeline after useFrame — Avatar's
 * writes are harmless there.
 *
 * Fog distances come from the tuning store; RailMover reads speed
 * and TunnelAlongSpline reads ring anchor positions from the same
 * store. The DebugPanel writes all three.
 */
export function RailPrototype() {
  const fogNear = useTuningStore((s) => s.fogNear);
  const fogFar = useTuningStore((s) => s.fogFar);
  return (
    <>
      <color attach="background" args={['#000005']} />
      <fog attach="fog" args={['#000005', fogNear, fogFar]} />

      <ambientLight intensity={0.45} />
      <pointLight position={[0, 0, -3]} intensity={1.2} color="#5fd0ff" />

      <RailMover />
      <TunnelAlongSpline />
      <RailGridFloor />
      <OrbField />
      <Avatar />
      <CascadeFlash />
      <AimTracker />
    </>
  );
}