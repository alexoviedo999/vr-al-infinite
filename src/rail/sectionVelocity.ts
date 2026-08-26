import type { SectionBoundary } from './musicMap';

/**
 * Section-driven velocity curve for ticket #12.
 *
 * `velocityAt(t, sections, baseSpeed)` returns the rail's current
 * speed as `baseSpeed × section.velocity`, where `section` is the
 * last entry in `sections` whose `startT ≤ t` (step-function
 * transitions: the multiplier changes instantaneously at each
 * boundary).
 *
 * Edge cases:
 *   - t ≤ first section's startT → first section's velocity (a value
 *     of 1.0 is the no-op fallback).
 *   - t ≥ last section's startT → last section's velocity.
 *   - empty sections array → returns `baseSpeed` (no scaling).
 *
 * The function is pure: it reads only its arguments, does not touch
 * module state, and is safe to call from per-frame `useFrame`
 * callbacks.
 *
 * Smoother blends (linear interpolation between adjacent sections
 * over a small t-window) are deliberately not implemented here — see
 * the ticket body. A step function keeps the rhythm in time with
 * discrete beats and matches how Rez-style games typically ship v1.
 */
export function velocityAt(
  t: number,
  sections: readonly SectionBoundary[],
  baseSpeed: number,
): number {
  if (sections.length === 0) return baseSpeed;
  let currentVelocity = sections[0].velocity;
  for (const s of sections) {
    if (s.startT <= t) currentVelocity = s.velocity;
    else break;
  }
  return baseSpeed * currentVelocity;
}