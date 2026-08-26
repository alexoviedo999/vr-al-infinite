import { useTuningStore } from '../state/tuningStore';
import { useLockOnStore } from '../state/lockOnStore';

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
  const musicMapEnabled = useTuningStore((s) => s.musicMapEnabled);
  const sectionCurvatureScale = useTuningStore((s) => s.sectionCurvatureScale);
  const velocityProfileEnabled = useTuningStore((s) => s.velocityProfileEnabled);
  const setSpeed = useTuningStore((s) => s.setSpeed);
  const setFogNear = useTuningStore((s) => s.setFogNear);
  const setFogFar = useTuningStore((s) => s.setFogFar);
  const setRingAnchorT = useTuningStore((s) => s.setRingAnchorT);
  const setFirstOrbAnchorT = useTuningStore((s) => s.setFirstOrbAnchorT);
  const setMusicMapEnabled = useTuningStore((s) => s.setMusicMapEnabled);
  const setSectionCurvatureScale = useTuningStore((s) => s.setSectionCurvatureScale);
  const setVelocityProfileEnabled = useTuningStore((s) => s.setVelocityProfileEnabled);

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

      <div style={{ marginTop: 6, color: '#5fd0ff' }}>music map</div>
      <Checkbox
        label="section curvature on"
        checked={musicMapEnabled}
        onChange={setMusicMapEnabled}
      />
      <Slider
        label="curvature"
        value={sectionCurvatureScale}
        min={0}
        max={0.15}
        step={0.005}
        onChange={setSectionCurvatureScale}
      />
      <div style={{ marginTop: 4, opacity: 0.6, fontSize: 10 }}>
        Default 0.03 — keep at 0 to avoid Catmull-Rom knot wobble
      </div>
      <div style={{ marginTop: 4, opacity: 0.6, fontSize: 10 }}>
        Scales every section's curvature (#10)
      </div>

      <div style={{ marginTop: 6, color: '#5fd0ff' }}>velocity profile</div>
      <Checkbox
        label="section velocity on"
        checked={velocityProfileEnabled}
        onChange={setVelocityProfileEnabled}
      />
      <div style={{ marginTop: 4, opacity: 0.6, fontSize: 10 }}>
        intro 0.6 / drop 1.4 / breakdown 0.8 (#12)
      </div>
    </div>
  );
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