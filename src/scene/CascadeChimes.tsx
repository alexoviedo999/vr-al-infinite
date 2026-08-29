import { useEffect } from 'react';
import { cascadeChordHz } from '../audio/chimeScale';
import { playChime } from '../audio/playChime';
import { delayToNextBeat } from '../audio/sectionFromAnalysis';
import { playerTRef } from '../rail/railStore';
import { useLockOnStore } from '../state/lockOnStore';
import { useMusicMapStore } from '../state/musicMapStore';

/** Voices of a chord land on the same beat, 12ms apart — Rez "chord-ish". */
const CHORD_VOICE_MS = 12;

/**
 * Beat-grid quantized musical Chimes: cascade size becomes a diatonic
 * chord in the Track's key, scheduled on the next beat.
 */
export function CascadeChimes() {
  const lastCascade = useLockOnStore((s) => s.lastCascade);

  useEffect(() => {
    if (!lastCascade || lastCascade.ids.length === 0) return;
    const map = useMusicMapStore.getState();
    const nowSec = playerTRef.current * map.durationSec;
    const onBeat = delayToNextBeat(nowSec, map.beats);
    const freqs = cascadeChordHz(lastCascade.ids.length, map.key);
    freqs.forEach((hz, i) => {
      playChime(hz, onBeat + (i * CHORD_VOICE_MS) / 1000);
    });
  }, [lastCascade]);

  return null;
}
