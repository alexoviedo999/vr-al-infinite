import * as THREE from 'three';
import { useLockOnStore, worldPosOf, type ISpline, type LockOnTarget } from '../state/lockOnStore';
import { basisAt } from './rollingWindow';

/**
 * Renders the lock-on target list. Shared by LockOnPrototype (cone
 * fallback mode, where target.offset IS a world position) and
 * RailPrototype (rail mode, where target.offset is a cross-section
 * offset and world position is spline.position(anchorT) + offset).
 *
 * The store publishes its `spline` ref; OrbField picks the right
 * computation path per render so a missing setSpline call doesn't
 * silently place targets at the origin.
 */
export function OrbField() {
  const targets = useLockOnStore((s) => s.targets);
  const spline = useLockOnStore((s) => s.spline);
  return (
    <>
      {targets.map((t) => (
        <OrbWithRing key={t.id} target={t} spline={spline} />
      ))}
    </>
  );
}

function OrbWithRing({ target, spline }: { target: LockOnTarget; spline: ISpline | null }) {
  const worldPos: THREE.Vector3 = spline
    ? worldPosOf(target, basisAt, spline.position)
    : new THREE.Vector3(target.offset[0], target.offset[1], target.offset[2]);

  const color = !target.alive
    ? '#ff5f7f'
    : target.lockProgress > 0
    ? '#5fd0ff'
    : '#7a8a9a';
  const scale = target.alive ? 1 + target.lockProgress * 0.35 : 1;
  const ringOpacity = target.lockProgress;

  return (
    <group position={worldPos}>
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