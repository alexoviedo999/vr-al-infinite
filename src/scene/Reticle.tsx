import { useEffect, useState } from 'react';

/**
 * Screen-space reticle overlay for the lock-on prototype. Pure CSS —
 * follows the mouse via the window mousemove listener, renders a wire-
 * frame octagon (matching the Rez look from the screenRecording frames)
 * with a small "+" cross at the center.
 *
 * Why DOM not Three.js: the reticle is fixed in screen space (it
 * tracks the cursor, not a world-space point), and DOM is cheaper
 * than a billboarded mesh with no per-frame allocations.
 */
export function Reticle() {
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const size = 64;
  const stroke = 1.5;
  const color = '#5fd0ff';

  return (
    <div
      style={{
        position: 'fixed',
        left: pos.x - size / 2,
        top: pos.y - size / 2,
        width: size,
        height: size,
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 64 64">
        {/* Wireframe octagon — same silhouette as the Rez Infinite reticle. */}
        <polygon
          points="20,4 44,4 60,20 60,44 44,60 20,60 4,44 4,20"
          fill="none"
          stroke={color}
          strokeWidth={stroke}
        />
        {/* Center cross. */}
        <line x1={size / 2 - 6} y1={size / 2} x2={size / 2 + 6} y2={size / 2} stroke={color} strokeWidth={stroke} />
        <line x1={size / 2} y1={size / 2 - 6} x2={size / 2} y2={size / 2 + 6} stroke={color} strokeWidth={stroke} />
      </svg>
    </div>
  );
}
