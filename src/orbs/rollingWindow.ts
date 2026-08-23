import * as THREE from 'three';
import { tangent } from '../rail/spline';

/**
 * Rolling-window orb spawn logic for ticket #9.
 *
 * Pure functions: no React, no Three.js scene refs, no lockOnStore.
 * Independent of the existing prototype so it's testable in isolation.
 *
 * Public API:
 *   arcLengthOfOrbAnchor(orb, totalArcLength) — linear approx of where
 *     the orb sits in arc-length space.
 *   basisAt(t) — local frame at parameter t: { right, up, forward }.
 *   worldPosOf(orb, basisAt, position) — orb's world position.
 *   rollOrbs(currentOrbs, playerArcLength, totalArcLength,
 *            tFromArcLength, basisAt, position) — next orb list.
 *
 * The orbs sit in a rolling window of `ORB_WINDOW_SIZE` ahead of the
 * player; any that fall behind the player (or die from a kill cascade)
 * get recycled to a new anchor ahead. The cone test in lockOnStore.tick
 * runs against world position; offsets are stored in the cross-section
 * plane so they survive spline curvature changes (#10).
 */

export const ORB_WINDOW_SIZE = 6;
export const ORB_AHEAD_MIN = 0.05;
export const ORB_BEHIND_BUFFER = 0.02;
export const ORB_SPAWN_JITTER = 0.03;
export const ORB_SPAWN_MIN_GAP = 1.0;
export const TUNNEL_RADIUS = 3.0;

/**
 * Structural orb shape used by the rolling-window logic. Matches the
 * LockOnTarget that lockOnStore will publish after Phase 3 lands.
 */
export interface RollingOrb {
  id: number;
  anchorT: number;
  offset: [number, number, number];
  lockProgress: number;
  lockedAt: number | null;
  alive: boolean;
}

/**
 * Linear approximation of the orb's arc-length position.
 *
 * The Catmull-Rom curve isn't perfectly uniform (curve density varies
 * with control-point spacing), but for the 30-unit prototype rail the
 * error is well below ORB_BEHIND_BUFFER * totalArcLength, so a linear
 * map is precise enough for the recycle-threshold test.
 */
export function arcLengthOfOrbAnchor(
  orb: { anchorT: number },
  totalArcLength: number,
): number {
  return orb.anchorT * totalArcLength;
}

export interface Basis {
  right: THREE.Vector3;
  up: THREE.Vector3;
  forward: THREE.Vector3;
}

const _worldUp = new THREE.Vector3(0, 1, 0);
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();

/**
 * Local frame at parameter t: forward is the unit tangent, right and up
 * form an orthonormal pair perpendicular to it (worldUp = +Y as the
 * reference up direction).
 */
export function basisAt(t: number): Basis {
  const tan = tangent(t);
  _fwd.copy(tan);
  _right.crossVectors(_worldUp, _fwd).normalize();
  _up.crossVectors(_fwd, _right).normalize();
  return { right: _right.clone(), up: _up.clone(), forward: _fwd.clone() };
}

const _scratchPos = new THREE.Vector3();

/**
 * World position of an orb: spline point at anchorT, plus a lateral
 * offset expressed in the cross-section basis at anchorT.
 */
export function worldPosOf(
  orb: { anchorT: number; offset: [number, number, number] },
  basisAtFn: (t: number) => Basis,
  positionFn: (t: number) => THREE.Vector3,
): THREE.Vector3 {
  const p = positionFn(orb.anchorT);
  const b = basisAtFn(orb.anchorT);
  _scratchPos
    .copy(p)
    .addScaledVector(b.right, orb.offset[0])
    .addScaledVector(b.up, orb.offset[1])
    .addScaledVector(b.forward, orb.offset[2]);
  return _scratchPos.clone();
}

/**
 * Uniform sample in the unit disk, scaled to TUNNEL_RADIUS. The
 * along-tangent component is zero — orbs sit on the rail's cross-section.
 */
function randomOffset(): [number, number, number] {
  const r = Math.sqrt(Math.random()) * TUNNEL_RADIUS;
  const theta = Math.random() * 2 * Math.PI;
  return [r * Math.cos(theta), r * Math.sin(theta), 0];
}

export function rollOrbs(
  currentOrbs: RollingOrb[],
  playerArcLength: number,
  totalArcLength: number,
  tFromArcLength: (d: number) => number,
  basisAtFn: (t: number) => Basis,
  positionFn: (t: number) => THREE.Vector3,
): RollingOrb[] {
  const threshold = playerArcLength - ORB_BEHIND_BUFFER * totalArcLength;

  const aliveRecycled: RollingOrb[] = [];
  const recycledIds: number[] = [];

  for (const orb of currentOrbs) {
    if (!orb.alive || arcLengthOfOrbAnchor(orb, totalArcLength) < threshold) {
      recycledIds.push(orb.id);
    } else {
      aliveRecycled.push(orb);
    }
  }

  // Spawn anchor: at least ORB_AHEAD_MIN ahead of player, also past any
  // surviving orb so we never overwrite one.
  let nextArc = Math.max(
    playerArcLength + ORB_AHEAD_MIN * totalArcLength,
    ...aliveRecycled.map((o) => arcLengthOfOrbAnchor(o, totalArcLength)),
  );

  // Tracked set for min-gap evaluation (survivors + freshly placed).
  const aliveForGap: RollingOrb[] = [...aliveRecycled];

  const placedOrbs: RollingOrb[] = [];

  for (const id of recycledIds) {
    let placed: RollingOrb | null = null;

    for (let attempt = 0; attempt < 16; attempt++) {
      const d = nextArc + Math.random() * ORB_SPAWN_JITTER * totalArcLength;
      const anchorT = tFromArcLength(d);
      const offset = randomOffset();
      const candidate: RollingOrb = {
        id,
        anchorT,
        offset,
        lockProgress: 0,
        lockedAt: null,
        alive: true,
      };

      const candidatePos = worldPosOf(candidate, basisAtFn, positionFn);
      let collides = false;
      for (const existing of aliveForGap) {
        if (candidatePos.distanceTo(worldPosOf(existing, basisAtFn, positionFn)) < ORB_SPAWN_MIN_GAP) {
          collides = true;
          break;
        }
      }

      if (!collides) {
        placed = candidate;
        break;
      }
    }

    // Fallback: 16 attempts didn't find a clear spot. Accept whatever
    // the last roll produced so the prototype never deadlocks (matches
    // the original randomTargetPosition behaviour).
    if (!placed) {
      const d = nextArc + Math.random() * ORB_SPAWN_JITTER * totalArcLength;
      placed = {
        id,
        anchorT: tFromArcLength(d),
        offset: randomOffset(),
        lockProgress: 0,
        lockedAt: null,
        alive: true,
      };
    }

    aliveForGap.push(placed);
    nextArc = arcLengthOfOrbAnchor(placed, totalArcLength);
    placedOrbs.push(placed);
  }

  // Survivors first (preserves array order from the caller's perspective
  // for un-recycled entries), then newly-placed recycled orbs.
  return [...aliveRecycled, ...placedOrbs];
}
