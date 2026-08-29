import { useTuningStore } from '../state/tuningStore';
import { useLockOnStore } from '../state/lockOnStore';
import { useMusicMapStore } from '../state/musicMapStore';
import { extractMusicMap } from '../audio/extractMusicMap';
import { useEffect } from 'react';

/**
 * In-canvas tuning controls. Renders alongside the HUD with the same
 * monospace aesthetic. Wired to the tuning store; changes propagate
 * on the next frame (RailMover + TunnelAlongSpline read from
 * getState() in useFrame).
 *
 * Only rendered when RAIL_MODE is on — the LockOnPrototype path
 * doesn't need it.
 */
export function DebugPanel() {
  const speed = useTuningStore((s) => s.speed);
  const fogNear = useTuningStore((s) => s.fogNear);
  const fogFar = useTuningStore((s) => s.fogFar);
  const ringTs = useTuningStore((s) => s.ringAnchorTs);
  const firstOrbAnchorT = useTuningStore((s) => s.firstOrbAnchorT);
  const velocityProfileEnabled = useTuningStore((s) => s.velocityProfileEnabled);
  const setSpeed = useTuningStore((s) => s.setSpeed);
  const setFogNear = useTuningStore((s) => s.setFogNear);
  const setFogFar = useTuningStore((s) => s.setFogFar);
  const setRingAnchorT = useTuningStore((s) => s.setRingAnchorT);
  const setFirstOrbAnchorT = useTuningStore((s) => s.setFirstOrbAnchorT);
  const setVelocityProfileEnabled = useTuningStore((s) => s.setVelocityProfileEnabled);
  const mapStatus = useMusicMapStore((s) => s.status);
  const mapError = useMusicMapStore((s) => s.error);
  const mapSource = useMusicMapStore((s) => s.sourceName);
  const mapBpm = useMusicMapStore((s) => s.bpm);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('analyse');
    if (q === 'stressed') {
      void analyseUrl('/demo-tracks/dj-deep-stressed.aiff', 'dj-deep-stressed');
    }
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        padding: '8px 12px',
        background: 'rgba(0, 0, 0, 0.5)',
        border: '1px solid #2a3a4a',
        borderRadius: 4,
        fontSize: 11,
        fontFamily: 'monospace',
        color: '#a8c5d8',
        minWidth: 220,
      }}
    >
      <div style={{ color: '#5fd0ff', marginBottom: 4 }}>tuning</div>

      <Slider label="speed" value={speed} min={0.5} max={20} step={0.1} onChange={setSpeed} />
      <Slider label="fog near" value={fogNear} min={1} max={50} step={0.5} onChange={setFogNear} />
      <Slider label="fog far" value={fogFar} min={5} max={100} step={1} onChange={setFogFar} />

      <div style={{ marginTop: 6, color: '#5fd0ff' }}>ring anchors</div>
      {([0, 1, 2] as const).map((i) => (
        <Slider
          key={i}
          label={`ring ${i + 1}`}
          value={ringTs[i]}
          min={0.02}
          max={0.98}
          step={0.01}
          onChange={(v) => setRingAnchorT(i, v)}
        />
      ))}

      <div style={{ marginTop: 6, color: '#5fd0ff' }}>orbs</div>
      <Slider
        label="first orb t"
        value={firstOrbAnchorT}
        min={0.05}
        max={0.9}
        step={0.01}
        onChange={(v) => {
          setFirstOrbAnchorT(v);
          useLockOnStore.getState().resetRailTargets();
        }}
      />
      <div style={{ marginTop: 4, opacity: 0.6, fontSize: 10 }}>
        Live: rebuilds initial targets on every change
      </div>

      <div style={{ marginTop: 6, color: '#5fd0ff' }}>velocity profile</div>
      <Checkbox
        label="section velocity on"
        checked={velocityProfileEnabled}
        onChange={setVelocityProfileEnabled}
      />
      <div style={{ marginTop: 4, opacity: 0.6, fontSize: 10 }}>
        intro 0.6 / drop 1.4 / breakdown 0.8 — from the active Music Map
      </div>

      <div style={{ marginTop: 6, color: '#5fd0ff' }}>track</div>
      <label style={{ display: 'block', margin: '4px 0', fontSize: 10, color: '#7a8a9a' }}>
        upload audio
        <input
          type="file"
          accept="audio/*,.aiff,.aif,.wav,.mp3"
          disabled={mapStatus === 'extracting'}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void analyseFile(file);
          }}
          style={{ display: 'block', marginTop: 4, maxWidth: 200 }}
        />
      </label>
      <button
        type="button"
        disabled={mapStatus === 'extracting'}
        onClick={() => void analyseUrl('/demo-tracks/dj-deep-stressed.aiff', 'dj-deep-stressed')}
        style={{
          marginTop: 4,
          background: '#0d1d2e',
          border: '1px solid #2a3a4a',
          color: '#5fd0ff',
          fontFamily: 'monospace',
          fontSize: 10,
          padding: '4px 8px',
          cursor: 'pointer',
        }}
      >
        analyse demo: Stressed
      </button>
      <div style={{ marginTop: 4, opacity: 0.7, fontSize: 10 }}>
        {mapStatus === 'extracting' && `analysing ${mapSource ?? ''}…`}
        {mapStatus === 'ready' && `map ready: ${mapSource} · ${mapBpm.toFixed(1)} bpm`}
        {mapStatus === 'error' && `error: ${mapError}`}
        {mapStatus === 'idle' && 'mock map (upload to replace)'}
      </div>
    </div>
  );
}

async function analyseFile(file: File): Promise<void> {
  const store = useMusicMapStore.getState();
  store.setExtracting(file.name);
  try {
    const buffer = await file.arrayBuffer();
    const map = await extractMusicMap(buffer, file.name);
    store.setReady(map);
  } catch (err) {
    store.setError(err instanceof Error ? err.message : String(err));
  }
}

async function analyseUrl(url: string, name: string): Promise<void> {
  const store = useMusicMapStore.getState();
  store.setExtracting(name);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
    const buffer = await res.arrayBuffer();
    const map = await extractMusicMap(buffer, name);
    store.setReady(map);
  } catch (err) {
    store.setError(err instanceof Error ? err.message : String(err));
  }
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '2px 0' }}>
      <span style={{ width: 64, color: '#7a8a9a' }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1 }}
      />
      <span style={{ width: 36, textAlign: 'right' }}>{value.toFixed(2)}</span>
    </label>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '2px 0' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span style={{ color: '#7a8a9a' }}>{label}</span>
    </label>
  );
}