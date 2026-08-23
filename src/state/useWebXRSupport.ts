import { useEffect, useState } from 'react';

/**
 * Detects whether the runtime exposes the WebXR Device API and supports an
 * immersive-vr session. Returns `null` while checking, `true` / `false` once
 * resolved. Safe to call in SSR-free React (browser only).
 */
export function useWebXRSupport(): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('xr' in navigator)) {
      setSupported(false);
      return;
    }
    void navigator.xr
      ?.isSessionSupported('immersive-vr')
      .then((ok) => setSupported(ok))
      .catch(() => setSupported(false));
  }, []);

  return supported;
}
