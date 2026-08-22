import { Canvas } from '@react-three/fiber';
import { Scene } from './scene/Scene';
import { EnterVRButton } from './scene/EnterVRButton';
import { useWebXRSupport } from './state/useWebXRSupport';

export default function App() {
  const xrSupported = useWebXRSupport();

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Canvas
        // Quest 3 perf budget: MSAA off, FFR negotiated via WebXR optionalFeatures.
        // Single Canvas per the locked decision in #1.
        gl={{
          antialias: false,
          powerPreference: 'high-performance',
          alpha: false,
        }}
        dpr={[1, 1.25]}
        frameloop="always"
        camera={{ position: [0, 0, 5], fov: 70 }}
        // Make the WebXR manager accept session requests with FFR enabled.
        onCreated={({ gl }) => {
          gl.xr.enabled = true;
        }}
      >
        <Scene />
      </Canvas>

      <div
        style={{
          position: 'fixed',
          top: 16,
          left: 16,
          padding: '8px 12px',
          background: 'rgba(0, 0, 0, 0.5)',
          border: '1px solid #2a3a4a',
          borderRadius: 4,
          fontSize: 12,
          pointerEvents: 'none',
          fontFamily: 'monospace',
        }}
      >
        <div>vr-al-infinite — bootstrap scaffold</div>
        <div>WebXR: {xrSupported === null ? 'checking…' : xrSupported ? 'available' : 'not available'}</div>
      </div>

      <EnterVRButton />
    </div>
  );
}
