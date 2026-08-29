import { useEffect } from 'react';
import { delayToNextBeat } from '../audio/sectionFromAnalysis';
import { playChime } from '../audio/playChime';
import { playerTRef } from '../rail/railStore';
import { LOCKON_CASCADE_STAGGER_MS } from '../state/lockOnStore';
import { useLockOnStore } from '../state/lockOnStore';
import { useMusicMapStore } from '../state/musicMapStore';

/**
 * Plays a Chime per locked orb, quantized to the next beat on the
 * active Music Map's Beat Grid, then staggered 50ms for the chord.
 */
export function CascadeChimes() {
  const lastCascade = useLockOnStore((s) => s.lastCascade);

  useEffect(() => {
    if (!lastCascade || lastCascade.ids.length === 0) return;
    const map = useMusicMapStore.getState();
    const nowSec = playerTRef.current * map.durationSec;
    const quantize = delayToNextBeat(nowSec, map.beats);
    lastCascade.ids.forEach((_, i) => {
      playChime(i, quantize + (i * LOCKON_CASCADE_STAGGER_MS) / 1000);
    });
  }, [lastCascade]);

  return null;
}
