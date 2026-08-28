import { describe, expect, it, vi } from 'vitest';
import { bindXrSelectFire } from '../scene/bindXrSelectFire';

/**
 * Seam for the #6 follow-up: Quest trigger (WebXR primary action)
 * must call the same fire cascade as Space. The helper is a thin
 * bind/unbind around `selectstart` so AimTracker doesn't have to
 * know the event name, and so we can unit-test the contract without
 * an XR session.
 */
describe('bindXrSelectFire', () => {
  function mockSession() {
    const listeners = new Map<string, EventListener>();
    return {
      listeners,
      addEventListener: (type: string, listener: EventListener) => {
        listeners.set(type, listener);
      },
      removeEventListener: (type: string, listener: EventListener) => {
        if (listeners.get(type) === listener) listeners.delete(type);
      },
    };
  }

  it('fires on selectstart (trigger press), not on selectend', () => {
    const session = mockSession();
    const onFire = vi.fn();
    bindXrSelectFire(session, onFire);

    expect(session.listeners.has('selectstart')).toBe(true);
    session.listeners.get('selectstart')!(new Event('selectstart'));
    expect(onFire).toHaveBeenCalledTimes(1);

    session.listeners.get('selectend')?.(new Event('selectend'));
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('unbind removes the selectstart listener', () => {
    const session = mockSession();
    const onFire = vi.fn();
    const unbind = bindXrSelectFire(session, onFire);
    unbind();
    expect(session.listeners.has('selectstart')).toBe(false);
  });
});
