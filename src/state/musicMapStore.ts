import { create } from 'zustand';
import { MockMusicMap, type MusicMap } from '../rail/musicMap';
import { RealMusicMap } from '../audio/RealMusicMap';
import type { SerializedMusicMap } from '../audio/sectionFromAnalysis';

export type MusicMapStatus = 'idle' | 'extracting' | 'ready' | 'error';

const MOCK = new MockMusicMap();

interface MusicMapState {
  status: MusicMapStatus;
  error: string | null;
  sourceName: string | null;
  map: MusicMap;
  /** Cached so per-frame readers don't allocate (MockMusicMap.beats() is fresh). */
  beats: readonly number[];
  durationSec: number;
  bpm: number;
  setExtracting: (sourceName: string) => void;
  setReady: (serialized: SerializedMusicMap) => void;
  setError: (error: string) => void;
  resetToMock: () => void;
}

export const useMusicMapStore = create<MusicMapState>((set) => ({
  status: 'idle',
  error: null,
  sourceName: null,
  map: MOCK,
  beats: MOCK.beats(),
  durationSec: MOCK.durationSec(),
  bpm: 120,
  setExtracting: (sourceName) =>
    set({ status: 'extracting', error: null, sourceName }),
  setReady: (serialized) =>
    set({
      status: 'ready',
      error: null,
      sourceName: serialized.trackId,
      map: new RealMusicMap(serialized),
      beats: serialized.beats,
      durationSec: serialized.durationSec,
      bpm: serialized.bpm,
    }),
  setError: (error) => set({ status: 'error', error }),
  resetToMock: () =>
    set({
      status: 'idle',
      error: null,
      sourceName: null,
      map: MOCK,
      beats: MOCK.beats(),
      durationSec: MOCK.durationSec(),
      bpm: 120,
    }),
}));
