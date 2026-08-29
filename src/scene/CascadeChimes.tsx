import { useEffect } from 'react';
import { playChime } from '../audio/playChime';
import { LOCKON_CASCADE_STAGGER_MS } from '../state/lockOnStore';
import { useLockOnStore } from '../state/lockOnStore';

/**
 * Plays a placeholder Chime per locked orb in the last cascade,
 * staggered to match the kill timing. Lives outside the Canvas.
 */
export function CascadeChimes() {
  const lastCascade = useLockOnStore((s) => s.lastCascade);

  useEffect(() => {
    if (!lastCascade || lastCascade.ids.length === 0) return;
    lastCascade.ids.forEach((_, i) => {
      playChime(i, (i * LOCKON_CASCADE_STAGGER_MS) / 1000);
    });
  }, [lastCascade]);

  return null;
}
