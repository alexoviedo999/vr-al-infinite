# Forward Rail Motion — Implementation Plan

**Ticket**: #9
**Spec**: [`docs/superpowers/specs/2026-08-23-forward-rail-motion-design.md`](../specs/2026-08-23-forward-rail-motion-design.md)
**Date**: 2026-08-23
**Branch**: `feat/forward-rail-motion` (cut from `main` after #9/#10/#11/#12 are filed — currently all four are on `docs/visual-baseline` ahead of #9)

## Goal

Bring the spec at `docs/superpowers/specs/2026-08-23-forward-rail-motion-design.md` to working code: a player camera that glides along an authored Catmull-Rom rail through a Tunnel of pre-placed meshes, with a rolling window of 6 orbs always ahead. Lockon cone math corrected to be player-relative. Lands as a third scene (`RailPrototype`) alongside the existing `LockOnPrototype` and bootstrap `Scene`.

Acceptance criteria (from spec §Acceptance criteria):
1. `npm run dev` boots into `RailPrototype` on desktop
2. Mouse aims; Space fires a cascade
3. Camera glides forward at constant speed
4. Exactly 6 orbs sit ahead at all times within the tunnel cross-section
5. Killed or passed orbs recycle to new positions ahead
6. `npm test` green for spline, rollingWindow, lockOnStore, railStore
7. `npm run typecheck` and `npm run lint` pass
8. HUD reads `"vr-al-infinite — rail motion prototype (#9)"`

## Sequencing principle

Pure logic first (no React, no Three.js scene refs) so each phase is independently testable in Vitest/jsdom before the next phase builds on it. Stores second (state shape changes are surgical and gated by tests). Components last (depend on stores). Composition last (depends on all components). One commit per phase so review is incremental.

## Phases

### Phase 0 — Branch + scaffolding

**Branch**: `feat/forward-rail-motion` cut from `main`. The four tickets (#9/#10/#11/#12) are filed but unstarted on `docs/visual-baseline`; cutting from main keeps the working set clean.

**Files**:
- `src/rail/.gitkeep` — empty marker
- `src/tunnel/.gitkeep` — empty marker
- `src/orbs/.gitkeep` — empty marker
- `docs/superpowers/plans/2026-08-23-forward-rail-motion-plan.md` — this file

**Verification**: `git status` shows new branch; empty dirs visible in tree.

---

### Phase 1 — Spline math (`src/rail/spline.ts` + `src/rail/points.ts`)

**Depends on**: Phase 0.

Pure functions, no React, no Three.js scene refs. Testable in isolation. This is the foundation everything else hangs off.

**Files**:
- `src/rail/points.ts` — exports `CONTROL_POINTS: Vector3[]`. First-cut authoring: 5 points along +Z with mild x/y offsets (e.g. `[(0,0,0), (1.2,0.4,-6), (-0.8,0.8,-14), (0.6,-0.5,-22), (0,0,-30)]`).
- `src/rail/spline.ts` — exports:
  - `position(t: number): Vector3` — Catmull-Rom interpolation, tension 0.5
  - `tangent(t: number): Vector3` — first derivative, normalized
  - `arcLength(t: number): number` — cumulative arc length at parameter `t`
  - `tFromArcLength(d: number): number` — inverse map via 256-entry lookup table + linear interp
  - Total arc length cached at module load
- `src/__tests__/spline.test.ts` — new.

**Tests** (`spline.test.ts`):
- `position(0)` returns the first control point
- `position(1)` returns the last control point
- `tangent(0)` and `tangent(1)` are unit length
- `tangent(t)` unit length at `t ∈ {0.0, 0.25, 0.5, 0.75, 1.0}`
- `arcLength(0) === 0` and `arcLength(1) === totalArcLength`
- `arcLength` is monotonically non-decreasing for the 256-entry sample grid
- `tFromArcLength(arcLength(t))` round-trips within `1e-3` for `t ∈ {0.1, 0.3, 0.5, 0.7, 0.9}`
- `tFromArcLength(0)` returns 0; `tFromArcLength(totalArcLength)` returns 1
- Clamping: `tFromArcLength(-1)` returns 0; `tFromArcLength(totalArcLength + 100)` returns 1

**Commit**: `feat(rail): spline math + Catmull-Rom interpolation (#9)`

**Verification**: `npm test -- spline` green; `npm run typecheck` green.

---

### Phase 2 — Orb rolling window pure logic (`src/orbs/rollingWindow.ts`)

**Depends on**: Phase 1 (because `tFromArcLength` is used to convert arc-length → `anchorT`).

Pure function, no React, no Three.js scene refs. Independent of `lockOnStore` so it's testable without setting up the store.

**Files**:
- `src/orbs/rollingWindow.ts` — exports:
  - Constants: `ORB_WINDOW_SIZE = 6`, `ORB_AHEAD_MIN = 0.05`, `ORB_BEHIND_BUFFER = 0.02`, `ORB_SPAWN_JITTER = 0.03`, `ORB_SPAWN_MIN_GAP = 1.0`, `TUNNEL_RADIUS = 3.0`
  - `arcLengthOfOrbAnchor(orb: { anchorT: number }, totalArcLength: number, tFromArcLength: (d: number) => number): number` — pure helper
  - `rollOrbs(currentOrbs, playerArcLength, totalArcLength, tFromArcLength, basisAt): LockOnTarget[]` — pure
  - `basisAt(t: number): { right: Vector3, up: Vector3, forward: Vector3 }` — pure helper (depends on `spline.tangent`)
- `src/__tests__/rollingWindow.test.ts` — new.

**Tests** (`rollingWindow.test.ts`):
- Output length is exactly `ORB_WINDOW_SIZE` (regardless of input state)
- All alive output orbs have `arcLengthOfOrbAnchor ≥ playerArcLength - ORB_BEHIND_BUFFER * totalArcLength`
- All alive output orbs have world-space distance from spline ≤ `TUNNEL_RADIUS` (basis + offset → position)
- `ORB_SPAWN_MIN_GAP` respected (200-trial property test with random player positions)
- IDs of un-recycled orbs are preserved
- A dead orb is recycled (alive becomes true, anchorT advances)
- An orb whose anchorT is behind the player by `ORB_BEHIND_BUFFER` is recycled

**Commit**: `feat(orbs): rolling-window orb spawn logic (#9)`

**Verification**: `npm test -- rollingWindow` green; `npm run typecheck` green.

---

### Phase 3 — Lockon store updates (`src/state/lockOnStore.ts`)

**Depends on**: Phase 2 (uses `basisAt` and `rollOrbs` indirectly via callbacks).

Surgical API changes. All existing tests must continue to pass with updated signatures.

**Files**:
- `src/state/lockOnStore.ts` — modify:
  - Add `ISpline` interface (declares `position`, `tangent`, `arcLength`, `tFromArcLength`) in this file or a shared `src/state/splineTypes.ts` (decided at implementation time — pick whichever keeps the dep graph cleanest)
  - `LockOnTarget`: remove `position`; add `anchorT: number` and `offset: [number, number, number]`
  - `INITIAL_TARGETS` replaced: each entry maps to a `{ anchorT, offset: [0,0,0] }` that produces the same world position via a stub spline in the test environment (or, for backward compat, the store accepts a default spline that maps `anchorT → known points`)
  - Add `setSpline(spline: ISpline | null)` action
  - Add `recyclePassed(playerArcLength: number, totalArcLength: number, tFromArcLength, basisAt)` action
  - `tick(aimDir, playerPos, dt, nowMs)`: signature gains `playerPos`. Cone test uses `worldPosOf(target).sub(playerPos).normalize()` when a spline is set; falls back to existing origin-relative math otherwise.
  - `randomTargetPosition` renamed to `respawnOrbPosition(currentOrbs, excludeIds, playerArcLength, totalArcLength, tFromArcLength, basisAt)`. New behaviour: rolling-window spawn (calls the same logic as `rollOrbs`).
  - `fire()` cascade timer calls `respawnOrbPosition` with the new signature
- `src/__tests__/lockOnStore.test.ts` — update.

**Tests** (update `lockOnStore.test.ts`):
- Existing tests pass `Vector3(0, 0, 0)` as `playerPos`
- New helper: a stub `ISpline` whose `position` is a lookup from `anchorT → known Vector3`; `tFromArcLength` is linear; `arcLength` is monotone
- Existing behavioural assertions hold: fill, decay, cascade ordering, respawn, re-roll
- New test: target with `anchorT` mapping to world `[-2, 0, -6]` is in-cone when player is at `[0, 0, 5]` and aim is `normalize(worldPos.sub(playerPos))` — proves the player-relative math works
- New test: with `setSpline` not called, behaviour is identical to the current implementation (fallback path)

**Commit**: `feat(lockon): player-relative cone + recyclePassed (#9)`

**Verification**: `npm test -- lockOnStore` green; `npm run typecheck` green.

---

### Phase 4 — Rail store + RailMover (`src/rail/railStore.ts` + `src/rail/RailMover.tsx`)

**Depends on**: Phase 1 (spline), Phase 3 (lockon store — for the recyclePassed handoff shape).

The first component that touches the R3F render loop. Owns the per-frame player position.

**Files**:
- `src/rail/railStore.ts` — exports:
  - `useRailStore` (zustand) — refs for `playerT`, `playerPos`, `tangent` (per-frame, mutable; not in Zustand state)
  - Zustand state: `runState: 'idle' | 'running' | 'ended'`, actions `start()`, `end()`
  - `getSpeed(t: number): number` — constant `RAIL_SPEED = 6` for #9; #12 replaces this
  - Refs are exposed via a small `usePlayerPosition()` hook for downstream consumers
- `src/rail/RailMover.tsx` — new component:
  - `useFrame((_, dt) => ...)`: advances `playerT`, computes `playerPos` + `tangent`, writes to refs, sets `camera.position.copy(playerPos)` and orient camera to look along `tangent`
  - On `playerT >= 1.0`: dispatch `runState = 'ended'`
  - On mount: calls `useLockOnStore.getState().setSpline({ position, tangent, arcLength, tFromArcLength })`
  - On unmount: calls `setSpline(null)` so the lockon-only prototype isn't broken
- `src/__tests__/railStore.test.ts` — new, minimal.

**Tests** (`railStore.test.ts`):
- `useRailStore.getState().start()` sets `runState = 'running'`
- `useRailStore.getState().end()` sets `runState = 'ended'`
- Refs aren't directly testable in jsdom; cover with a comment explaining why

**Commit**: `feat(rail): rail store + RailMover (#9)`

**Verification**: `npm test -- railStore` green; `npm run typecheck` green; manual desktop smoke (motion works in browser).

---

### Phase 5 — Tunnel meshes + TunnelAlongSpline (`src/tunnel/`)

**Depends on**: Phase 1 (spline), Phase 4 (playerT ref).

Visual layer for the tunnel. Renders authored meshes along the spline.

**Files**:
- `src/tunnel/meshes.ts` — exports `TUNNEL_PIECES: TunnelPiece[]` (4–6 wireframe primitives at hand-picked `anchorT` values)
- `src/tunnel/TunnelAlongSpline.tsx` — new component:
  - On mount: build a `<group>` of all pieces
  - Single `useFrame` at the group level: for each piece, sample spline + basis, set `piece.position` and `piece.quaternion`
- Update `src/scene/LockOnPrototype.tsx`'s `TunnelStub` — keep for reference but don't remove (the bootstrap scene still uses it)

**Tests**:
- No new test files; the rendering is integration-tested via the desktop smoke (Phase 7).

**Commit**: `feat(tunnel): authored meshes along the spline (#9)`

**Verification**: `npm run typecheck` green; `npm run lint` green; desktop smoke shows tunnel pieces in their authored positions as the rail advances.

---

### Phase 6 — OrbField extraction + AimTracker extraction (`src/orbs/OrbField.tsx` + `src/scene/AimTracker.tsx`)

**Depends on**: Phase 3 (lockon store with `setSpline` + `recyclePassed`), Phase 4 (`camera.position` is the player position).

Component extraction so both `RailPrototype` and `LockOnPrototype` can share the orb-rendering and aim-tracking code.

**Files**:
- `src/orbs/OrbField.tsx` — new:
  - Extracted from `LockOnPrototype.TargetsAndRings` + `TargetWithRing`
  - Subscribes to `useLockOnStore((s) => s.targets)`
  - World position computed from `anchorT` + `offset` via the basis helper
- `src/scene/AimTracker.tsx` — new:
  - Extracted from `LockOnPrototype.AimTracker`
  - `useFrame`: calls `recyclePassed(...)` then `tick(...)`
  - Space key fires `useLockOnStore.getState().fire()`
- Update `src/scene/LockOnPrototype.tsx`: remove `TargetsAndRings`, `TargetWithRing`, `AimTracker`; import from `OrbField` and `AimTracker` instead

**Tests**:
- No new tests; the existing `lockOnStore.test.ts` covers the store contract that `OrbField`/`AimTracker` rely on.

**Commit**: `refactor(scene): extract OrbField + AimTracker (#9)`

**Verification**: `npm test` all green; `npm run typecheck` green; `npm run lint` green; flipping `RAIL_MODE` off restores the existing `LockOnPrototype` scene exactly.

---

### Phase 7 — Scene composition + App.tsx gating (`src/scene/RailPrototype.tsx` + `src/App.tsx`)

**Depends on**: Phases 4, 5, 6.

Top-level wiring. The user-visible scene.

**Files**:
- `src/scene/RailPrototype.tsx` — new:
  - `<color>`, `<fog>`, lights (matches `LockOnPrototype` values)
  - `<RailMover />` first (to win the useFrame ordering)
  - `<TunnelAlongSpline />`, `<OrbField />`, `<AimTracker />`
- `src/App.tsx` — modify:
  - Add `RAIL_MODE = true` constant
  - Render `{RAIL_MODE ? <RailPrototype /> : PROTOTYPE_MODE ? <LockOnPrototype /> : <Scene />}`
  - HUD text: `"vr-al-infinite — rail motion prototype (#9)"` when `RAIL_MODE`
  - Hoist the HUD block into a helper only if the conditionals get noisy

**Tests**:
- Manual desktop smoke (Phase 7 acceptance). No new automated tests at this phase — wiring is integration-level.

**Commit**: `feat(scene): RailPrototype + App.tsx RAIL_MODE gating (#9)`

**Verification**:
- `npm test` green
- `npm run typecheck` green
- `npm run lint` green
- `npm run dev` boots; camera glides along rail; tunnel pieces appear; orbs spawn ahead; mouse aim + Space fire cascade
- Flip `RAIL_MODE = false`: lockon prototype renders unchanged
- Flip `RAIL_MODE = false` AND `PROTOTYPE_MODE = false`: bootstrap scene renders unchanged

---

### Phase 8 — Acceptance verification + PR

**Depends on**: All prior phases.

**Verification** (run all from acceptance criteria):
1. `npm run dev` → `RailPrototype` renders
2. Mouse moves → aim ray updates; Space → cascade fire on locked orbs
3. Camera glides forward at `RAIL_SPEED = 6` units/sec; rail traversed in `totalArcLength / 6` seconds
4. Exactly 6 orbs visible ahead at any moment (verify by visual count across 5 random frames)
5. Kill a cascade → orbs respawn ahead after `LOCKON_RESPAWN_MS`; pass an orb → it recycles to a new anchor ahead
6. `npm test` all four test files green
7. `npm run typecheck` + `npm run lint` green
8. HUD reads `"vr-al-infinite — rail motion prototype (#9)"`

**PR**:
- Title: `feat(rail): forward rail motion prototype (#9)`
- Body: link to spec + plan; checklist of acceptance criteria with green checks
- Reviewer notes: highlight the surgical lockon-store API changes and the seam left for #10/#11/#12

**Commit** (squash or merge): clean single commit on `main` after approval.

---

## File summary (final state)

| File | Status | Phase |
|---|---|---|
| `src/rail/points.ts` | new | 1 |
| `src/rail/spline.ts` | new | 1 |
| `src/rail/railStore.ts` | new | 4 |
| `src/rail/RailMover.tsx` | new | 4 |
| `src/tunnel/meshes.ts` | new | 5 |
| `src/tunnel/TunnelAlongSpline.tsx` | new | 5 |
| `src/orbs/rollingWindow.ts` | new | 2 |
| `src/orbs/OrbField.tsx` | new | 6 |
| `src/scene/RailPrototype.tsx` | new | 7 |
| `src/scene/AimTracker.tsx` | new (extracted) | 6 |
| `src/scene/LockOnPrototype.tsx` | modified (use extracted components) | 6 |
| `src/state/lockOnStore.ts` | modified (player-relative cone + recyclePassed + setSpline) | 3 |
| `src/App.tsx` | modified (RAIL_MODE flag + mount chain) | 7 |
| `src/__tests__/spline.test.ts` | new | 1 |
| `src/__tests__/rollingWindow.test.ts` | new | 2 |
| `src/__tests__/lockOnStore.test.ts` | modified (signature updates + new player-relative test) | 3 |
| `src/__tests__/railStore.test.ts` | new (minimal) | 4 |

## Out of scope (explicit)

- #10 Music Map-driven rail curvature — file already references the seam (`setSpline` interface)
- #11 avatar mesh + HMD-overridable camera — file mentions the future seam
- #12 section-driven velocity — `getSpeed(t)` is the seam
- Controller trigger wiring (deferred from #6)
- VR run (desktop validation only for #9; Quest 3 hardware pass is a follow-up)

## Risks (carried from spec)

- Far-from-origin float precision — not a concern for the short finite rail
- Camera + HMD pose double-write in VR — R3F XR pipeline takes over after useFrame; harmless
- One-frame orb staleness during `recyclePassed`/`tick` ordering — acceptable at 60Hz, documented
- `lockOnStore` must not import from `rail/` — `ISpline` interface declared locally or in a shared `state/splineTypes.ts`

## Reference

- Spec: `docs/superpowers/specs/2026-08-23-forward-rail-motion-design.md`
- Tickets: #9 (this), #10, #11, #12
- Wayfinder map: #1
- Visual baseline: #7 (aesthetic anchor for the tunnel mesh choices)
- Quest 3 perf rules: `docs/research/quest3-webxr-perf.md`
