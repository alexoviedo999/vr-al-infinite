import { OrbField } from '../orbs/OrbField';
import { RailMover } from '../rail/RailMover';
import { TunnelAlongSpline } from '../tunnel/TunnelAlongSpline';
import { AimTracker } from './AimTracker';

/**
 * Forward-rail motion prototype for ticket #9.
 *
 * Render order matters: RailMover writes the camera pose every frame
 * so TunnelAlongSpline, OrbField, and AimTracker all read a current
 * player position. R3F runs useFrame callbacks in render-tree order.
 */
export function RailPrototype() {
  return (
    <>
      <color attach="background" args={['#000005']} />
      <fog attach="fog" args={['#000005', 6, 30]} />

      <ambientLight intensity={0.45} />
      <pointLight position={[0, 0, -3]} intensity={1.2} color="#5fd0ff" />

      <RailMover />
      <TunnelAlongSpline />
      <OrbField />
      <AimTracker />
    </>
  );
}