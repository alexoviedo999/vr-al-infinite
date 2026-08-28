/**
 * Bind the WebXR primary action (`selectstart` = trigger press on Quest)
 * to a fire callback. Returns an unbind function.
 *
 * Press-to-fire matches the existing Space-keydown cascade from #6.
 * CONTEXT.md's Rez-faithful "releasing the trigger fires" (hold-to-lock,
 * release-to-fire) is a later change — wiring `select`/`selectend` now
 * would make VR fire on a different edge than desktop.
 *
 * Uses the raw WebXR Device API (locked stack in #1) rather than IWSDK
 * or @react-three/xr. Meta's first-steps sample maps the trigger to the
 * primary action; `selectstart` is that press edge.
 */
export function bindXrSelectFire(
  session: {
    addEventListener: (type: string, listener: EventListener) => void;
    removeEventListener: (type: string, listener: EventListener) => void;
  },
  onFire: () => void,
): () => void {
  const handler: EventListener = () => onFire();
  session.addEventListener('selectstart', handler);
  return () => session.removeEventListener('selectstart', handler);
}
