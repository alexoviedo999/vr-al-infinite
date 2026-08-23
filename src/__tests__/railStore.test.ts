import { getSpeed, playerTRef, RAIL_SPEED, useRailStore } from '../rail/railStore';

describe('useRailStore', () => {
  beforeEach(() => {
    useRailStore.setState({ runState: 'idle' });
    playerTRef.current = 0;
  });

  it('starts in idle', () => {
    expect(useRailStore.getState().runState).toBe('idle');
  });

  it('start() transitions runState to running', () => {
    useRailStore.getState().start();
    expect(useRailStore.getState().runState).toBe('running');
  });

  it('end() transitions runState to ended', () => {
    useRailStore.getState().end();
    expect(useRailStore.getState().runState).toBe('ended');
  });
});

describe('getSpeed', () => {
  it('returns RAIL_SPEED (constant for #9)', () => {
    expect(getSpeed(0)).toBe(RAIL_SPEED);
    expect(getSpeed(0.5)).toBe(RAIL_SPEED);
    expect(getSpeed(1)).toBe(RAIL_SPEED);
  });
});

// Per-frame refs (playerTRef, playerPosRef, tangentRef) are mutated
// inside RailMover's useFrame and require an R3F render tree to drive
// them; they're not directly testable in jsdom without mocking three.js
// rendering. They're covered by the manual desktop smoke in Phase 7.
