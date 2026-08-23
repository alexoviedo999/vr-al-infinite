import { OrbField } from '../orbs/OrbField';
import { RailMover } from '../rail/RailMover';
import { TunnelAlongSpline } from '../tunnel/TunnelAlongSpline';
import { AimTracker } from './AimTracker';
import { useTuningStore } from '../state/tuningStore';

/**
 * Forward-rail motion prototype for ticket #9.
 *
 * Render order matters: RailMover writes the camera pose every frame
 * so TunnelAlongSpline, OrbField, and AimTracker all read a current
 * player position. R3F runs useFrame callbacks in render-tree order.
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
      <OrbField />
      <AimTracker />
    </>
  );
}