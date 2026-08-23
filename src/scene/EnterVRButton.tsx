import { useEffect, useState } from 'react';
import { useAppStore } from '../state/store';
import { useWebXRSupport } from '../state/useWebXRSupport';

/**
 * DOM overlay button that requests an immersive-vr WebXR session with FFR
 * enabled, then hands the session to the R3F WebXRManager via setSession().
 * Uses the raw WebXR Device API per the locked decision in #1.
 *
 * Lives outside the Canvas so it stays a 2D HUD in screen space. The R3F
 * renderer is captured at Canvas mount and exposed via `useAppStore`, so
 * we don't need any R3F hooks here (those would throw outside the Canvas).
 */
export function EnterVRButton() {
  const xrSupported = useWebXRSupport();
  const gl = useAppStore((s) => s.xrRenderer);
  const [isPresenting, setIsPresenting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gl) return;
    const onStart = () => setIsPresenting(true);
    const onEnd = () => setIsPresenting(false);
    gl.xr.addEventListener('sessionstart', onStart);
    gl.xr.addEventListener('sessionend', onEnd);
    return () => {
      gl.xr.removeEventListener('sessionstart', onStart);
      gl.xr.removeEventListener('sessionend', onEnd);
    };
  }, [gl]);

  if (xrSupported !== true) return null;
  if (!gl) return null;
  if (isPresenting) return null;

  const enterVR = async () => {
    setError(null);
    try {
      const session = await navigator.xr!.requestSession('immersive-vr', {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['high-fixed-foveation-level'],
      });
      await gl.xr.setSession(session);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <button
        onClick={() => void enterVR()}
        style={{
          padding: '12px 32px',
          fontSize: 16,
          background: '#0d1d2e',
          border: '1px solid #5fd0ff',
          borderRadius: 4,
          color: '#5fd0ff',
          cursor: 'pointer',
          fontFamily: 'monospace',
          letterSpacing: 1,
        }}
      >
        Enter VR
      </button>
      {error && (
        <div style={{ fontSize: 11, color: '#ff5f7f', fontFamily: 'monospace', maxWidth: 320, textAlign: 'center' }}>
          {error}
        </div>
      )}
    </div>
  );
}
