# Forward Rail Motion — Design Spec

**Ticket**: #9
**Status**: Approved for implementation planning
**Date**: 2026-08-23
**Part of**: #1 (wayfinder map)

## Goal

Add a fixed-Rail motion prototype: the player camera travels a fixed path through a reactive Tunnel for the duration of a Run, controlling look and aim but not where they go. Closes the open gap in the wayfinder map ("no ticket yet for rail motion, flagged as a non-trivial lift — avatar mesh + spline + camera sync").

When this lands, `RailPrototype` is a third scene mounted in `App.tsx` (alongside the existing `LockOnPrototype` and bootstrap `Scene`), validated on desktop, with the cone-test math corrected to be player-relative and the orb experience extended from "static box of 6" to "rolling window of 6 always ahead of the player".

## Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| Rail source | Authored control points (`Vector3[]` in `src/rail/points.ts`), Catmull-Rom interpolated | Reproducible, inspectable, leaves a clean hook for #10 (Music Map) to reshape the curve at section boundaries |
| Camera rig | First-person at the rail point, no avatar mesh | Cheapest first cut. #11 revisits with an avatar mesh + HMD-overridable head |
| Tunnel rendering | Authored meshes pre-placed along the spline (one piece per authored anchor-t slot) | Most Rez-like, supports bespoke visuals per segment |
| Orb strategy | Rolling window of `ORB_WINDOW_SIZE = 6` orbs ahead of the player | Procedural generation at the leading edge; matches the spirit of the Rez-clone pitch without authoring hundreds of orb positions |
| Motion profile | Constant velocity for #9 (`RAIL_SPEED = 6` units/sec) | Section-driven velocity deferred to #12 |
| Scene gating | New `RAIL_MODE` boolean alongside the existing `PROTOTYPE_MODE` in `App.tsx` | Minimal diff; preserves the existing two-mode comparison |

## Out of scope (deferred tickets)

- **#10** — Music Map-driven rail curvature. The rail API leaves a hook (`onSectionBoundary(t, tangent)`) for this but does not implement it.
- **#11** — Avatar mesh + HMD-overridable camera. The camera currently sits at the rail point with no body. Revisit once the rail feel is validated.
- **#12** — Section-driven velocity profile. The constant-velocity placeholder is read through a `getSpeed(t) => number` function so this is a drop-in replacement.
- Controller trigger wiring (deferred from #6).
- VR run (desktop validation only for #9).

## Architecture

```
src/
├── rail/
│   ├── points.ts             # authored control points (Vector3[])
│   ├── spline.ts             # Catmull-Rom: position(t), tangent(t), arcLength(t), tFromArcLength(d)
│   ├── railStore.ts          # refs (playerT, playerPos, tangent, speed) + sparse Zustand state (runState)
│   └── RailMover.tsx         # useFrame: advance playerT, write camera transform
├── tunnel/
│   ├── meshes.ts             # authored tunnel pieces (mesh + anchorT + lateralOffset + yawOffset)
│   └── TunnelAlongSpline.tsx # per-piece useFrame: sample spline, orient to tangent
├── orbs/
│   ├── rollingWindow.ts      # pure: rollOrbs(currentOrbs, playerT, railParams) => nextOrbs
│   └── OrbField.tsx          # renders lockon store targets (extracted from LockOnPrototype)
├── scene/
│   ├── RailPrototype.tsx     # top-level scene (replaces LockOnPrototype's slot when RAIL_MODE)
│   ├── LockOnPrototype.tsx   # unchanged
│   └── AimTracker.tsx        # extracted from LockOnPrototype for reuse by both scenes
├── state/
│   ├── lockOnStore.ts        # updated: tick(playerPos), recyclePassed(playerT), rolling-window respawn
│   └── store.ts              # unchanged (runState already here; rail inherits it)
└── App.tsx                   # adds RAIL_MODE flag; new mount chain
```

**Boundaries**:
- `spline.ts`, `rollingWindow.ts`, and `respawnOrbPosition` are pure functions. No React, no Three.js scene refs. Independently testable.
- `railStore.ts` exposes refs for per-frame data (playerT, playerPos, tangent) and Zustand for sparse state (runState). Matches the existing `store.ts` note: "per-frame mutation MUST NOT trigger setState".
- `TunnelAlongSpline.tsx` and `OrbField.tsx` are dumb renderers — they read state, no business logic.
- `lockOnStore.ts` does not import anything from `rail/`. Hand-off is via `playerT` / `playerPos` parameters.

## Spline math (`src/rail/spline.ts`)

Pure functions. No Three.js scene refs.

```ts
// Public API
export function position(t: number): Vector3      // t ∈ [0, 1] parametric
export function tangent(t: number): Vector3       // first derivative, normalized
export function arcLength(t: number): number      // distance traveled from start to t
export function tFromArcLength(d: number): number // inverse, for constant-velocity advancement
```

- **Interpolation**: Catmull-Rom over the authored control points. Tension `0.5` (centripetal — avoids loops and cusps).
- **Arc-length table**: 256-entry lookup built once at module load via Simpson's rule over `t ∈ [0, 1]`. Linear interpolation between entries. `tFromArcLength(d)` clamps and inverts.
- **Why arc-length parameterization**: uniform `t` → non-uniform distance (curves bunch up). Constant velocity needs the inverse map. Built once at module load so the per-frame cost is one table lookup.

## Player motion (`src/rail/railStore.ts` + `src/rail/RailMover.tsx`)

**Refs (per-frame, mutable)**:
- `playerT: number` — current parameter on the spline.
- `playerPos: Vector3` — computed from `spline.position(playerT)`.
- `tangent: Vector3` — computed from `spline.tangent(playerT)`.

**Zustand state (sparse)**:
- `runState: 'idle' | 'running' | 'ended'`.
- `start()` / `end()` actions. `end()` fires `onRunEnd` callback (set by App.tsx if needed).

**`RailMover.tsx`** — child of `<Canvas>`, uses `useFrame((_, dt) => ...)`:

1. If `runState === 'running'`:
   - `d = arcLength(playerT) + getSpeed(playerT) * dt`
   - `playerT = tFromArcLength(d)`, clamp to `[0, 1]`
2. Compute `playerPos = position(playerT)`, `tangent = tangent(playerT)`. Write to refs.
3. `camera.position.copy(playerPos)`. Set camera quaternion to look along `tangent`.
4. If `playerT >= 1.0`: dispatch `runState = 'ended'`.

**Speed**: `RAIL_SPEED = 6` units/sec. `getSpeed(t)` defaults to constant; #12 replaces it.

**VR override**: `gl.xr.getCamera()` returns the HMD-tracked camera during presentation; R3F's XR pipeline takes over before render. On desktop, the mover's write is what the user sees.

## Tunnel rendering (`src/tunnel/meshes.ts` + `src/tunnel/TunnelAlongSpline.tsx`)

**Authored list (`TUNNEL_PIECES`)**:
```ts
type TunnelPiece = { mesh: () => JSX.Element; anchorT: number; lateralOffset: Vector3; yawOffset: number };
```
For first cut: 4–6 wireframe primitives (torus rings, octahedrons, grid panels) at hand-picked `anchorT` values spanning the rail.

**Per-frame transform** (single `useFrame` at the group level):
1. For each piece: `pos = spline.position(anchorT)`, `tan = spline.tangent(anchorT)`.
2. Build basis: `forward = tan`, `right = up × tan` (normalized), `up = tan × right`.
3. `piece.position = pos + right · lateralOffset.x + up · lateralOffset.y`.
4. Orient piece quaternion to face along `forward`, rotated by `yawOffset` for visual variation.

The scene-level `<color attach="background">` and `<fog>` come from `RailPrototype.tsx` (matching `LockOnPrototype.tsx`'s setup).

## Orb rolling window (`src/orbs/rollingWindow.ts` + `src/state/lockOnStore.ts`)

**Orb shape**: `LockOnTarget` adds two fields (alongside the existing lock-progress / alive / lockedAt state):
- `anchorT: number` — parameter on the spline where the orb sits.
- `offset: [number, number, number]` — lateral offset in the cross-section plane perpendicular to the tangent at `anchorT` (right, up, along-tangent components).

World position is derived at render time: `spline.position(anchorT) + right(anchorT) · offset[0] + up(anchorT) · offset[1]`. Storing anchorT + offset (rather than world position) keeps orbs attached to the rail when #10 reshapes the curve.

The existing `position` field is removed; consumers (current `LockOnPrototype.TargetWithRing`, the lockon store's cone test) are updated to compute world position from anchorT + offset using a basis helper (`basisAt(t): { right, up, forward }`).

**Constants** (all expressed as fractions of total rail arc-length, except the gap which is world-space):
- `ORB_WINDOW_SIZE = 6` (matches current count).
- `ORB_AHEAD_MIN = 0.05` (minimum fraction of total arc-length ahead of the player).
- `ORB_BEHIND_BUFFER = 0.02` (fraction of total arc-length behind which orbs get recycled).
- `ORB_SPAWN_JITTER = 0.03` (random extra arc-length added to the spawn anchor, as a fraction of total).
- `ORB_SPAWN_MIN_GAP = 1.0` (world-space distance between alive orbs; intent matches the existing `SPAWN_MIN_GAP`).

**Pure logic** (`rollOrbs`):
```ts
function rollOrbs(
  current: LockOnTarget[],
  playerArcLength: number,
  totalArcLength: number,
): LockOnTarget[]
```
1. For each orb: if `!alive` OR `arcLengthOfOrbAnchor(orb) < playerArcLength - ORB_BEHIND_BUFFER * totalArcLength` → mark for recycle.
2. For each recycle slot:
   - Pick a target arc-length at `max(current.maxArcLength, playerArcLength + ORB_AHEAD_MIN * totalArcLength) + randomArcLength(0, ORB_SPAWN_JITTER * totalArcLength)`. Compute `anchorT = tFromArcLength(d)`.
   - Generate lateral offset as a 2D vector in the cross-section plane, clamped to the unit disk scaled by `TUNNEL_RADIUS = 3.0` (matches the existing wireframe cylinder).
   - Retry up to 16 times to satisfy `ORB_SPAWN_MIN_GAP` (world-space distance between alive orbs; evaluate via basis + position).
3. Return the updated list (preserving IDs for unchanged orbs).

**Integration with lockon store**:

- `lockOnStore.recyclePassed(playerArcLength, totalArcLength)`: calls `rollOrbs`, writes the result via `set`. Called once per frame from `AimTracker`'s useFrame, **before** `tick()` so the cone test in the same frame sees the freshly-rolled orb list.
- `lockOnStore.tick(aimDir, playerPos, dt, nowMs)`: signature update. Cone test becomes `dir = worldPosOf(target).sub(playerPos).normalize()` where `worldPosOf(target) = spline.position(target.anchorT) + basis(target.anchorT) · target.offset`.
- The lockon store needs a `setSpline(spline)` action (called once from `RailPrototype` on mount) so it can resolve world positions during the cone test. To keep `lockOnStore.ts` from importing anything in `rail/`, the spline is typed as an `ISpline` interface declared in `state/lockOnStore.ts` itself (or a shared `state/splineTypes.ts`); `rail/spline.ts` happens to satisfy it. When no spline is set (i.e. `LockOnPrototype` is mounted), the cone test falls back to the existing origin-relative math — preserving the current behaviour for the lockon-only prototype.
- `lockOnStore.randomTargetPosition` renamed to `respawnOrbPosition(currentOrbs, excludeIds, playerArcLength, totalArcLength)`. Same signature plus arc-length params; new behaviour uses rolling-window logic. The cascade-fire respawn (`fire()`'s setTimeout block) calls this instead.
- `fire()` respawn delay unchanged (`LOCKON_RESPAWN_MS = 1400ms`); the cascade stagger unchanged (`LOCKON_CASCADE_STAGGER_MS = 50ms`).

**OrbField** (`src/orbs/OrbField.tsx`): extracted from the existing `TargetWithRing` JSX in `LockOnPrototype.tsx`. Subscribes to `useLockOnStore((s) => s.targets)`. Each target's world position is computed at render time from `(anchorT, offset)` via the basis helper; the existing `position={target.position}` prop becomes `position={worldPosOf(target)}`. When `spline` is unset (lockon-only prototype), `worldPosOf` falls back to `[0, 0, 0]` and the field's parent component supplies the static positions (current behaviour).

## Scene composition (`src/scene/RailPrototype.tsx`)

```tsx
export function RailPrototype() {
  return (
    <>
      <color attach="background" args={['#000005']} />
      <fog attach="fog" args={['#000005', 6, 30]} />
      <ambientLight intensity={0.45} />
      <pointLight position={[0, 0, -3]} intensity={1.2} color="#5fd0ff" />

      <RailMover />           {/* owns playerT, playerPos refs; writes camera */}
      <TunnelAlongSpline />   {/* reads playerT/playerPos */}
      <OrbField />            {/* reads targets from lockon store */}
      <AimTracker />          {/* existing component, lifted out of LockOnPrototype */}
    </>
  );
}
```

**`useFrame` ordering**: `RailMover` must run before `TunnelAlongSpline`, `OrbField`, and `AimTracker`'s `tick` call. R3F runs useFrame callbacks in render-tree order; placing `<RailMover />` first in the JSX guarantees this.

**`AimTracker`** (extracted from `LockOnPrototype.tsx`):
- Reads mouse via `useThree().mouse`, computes world-space `aim = mouse.unproject(camera).sub(camera.position).normalize()`.
- Each frame: `recyclePassed(playerArcLength, totalArcLength)` (writes the orb list), then `tick(aim, camera.position, dt, performance.now())` (writes lock progress).
- Space key still fires `useLockOnStore.getState().fire()`.

## App.tsx gating

```tsx
const RAIL_MODE = true;        // ticket #9 prototype flag
const PROTOTYPE_MODE = true;   // ticket #6 prototype flag

// in <Canvas>:
{RAIL_MODE ? <RailPrototype /> : PROTOTYPE_MODE ? <LockOnPrototype /> : <Scene />}
```

HUD line: `"vr-al-infinite — rail motion prototype (#9)"`. The DOM HUD block can be hoisted into a small helper if the conditionals get noisy.

Reticle and EnterVRButton are unchanged.

## Tests

- **`src/__tests__/spline.test.ts`** — new.
  - `position(0)` returns the first control point.
  - `position(1)` returns the last control point.
  - `tangent(t)` is unit length for all `t`.
  - `arcLength(t)` is monotonically non-decreasing.
  - `tFromArcLength(arcLength(t))` round-trips within `1e-3` (table resolution).

- **`src/__tests__/rollingWindow.test.ts`** — new.
  - Output length is exactly `ORB_WINDOW_SIZE`.
  - All alive orbs have arc-length anchor ≥ `playerArcLength - ORB_BEHIND_BUFFER * totalArcLength`.
  - All alive orbs have world-space position within `TUNNEL_RADIUS` of the spline.
  - Respawn respects `ORB_SPAWN_MIN_GAP` (probabilistic — 200-trial property test with random player positions).

- **`src/__tests__/lockOnStore.test.ts`** — update.
  - Existing tests construct targets with `{ anchorT, offset: [0, 0, 0] }` (the cross-section-plane offset is zero, so `worldPosOf = spline.position(anchorT)`). Initial `INITIAL_TARGETS` is replaced with anchorT values that produce the same world positions as the current hardcoded list (anchorT = 0 for `[0, 0, 0]`, etc., or use a stub spline in the test that maps `t → known points`).
  - Existing tests pass `Vector3(0, 0, 0)` as `playerPos` where the new signature requires it. With `playerPos = origin`, `worldPosOf(target) = world position` and the cone test degenerates to the original origin-relative form, so behavioural assertions are unchanged.
  - New test: a target with `anchorT` mapping to world `[-2, 0, -6]` is in-cone when player is at `[0, 0, 5]` and aim direction is normalized(`worldPos.sub(playerPos)`). Proves the player-relative math works.

- **`src/__tests__/railStore.test.ts`** — new, minimal.
  - `start()` transitions `runState` from `'idle'` → `'running'`.
  - `end()` transitions to `'ended'`.
  - Per-frame refs (`playerT`, `playerPos`) aren't directly testable in jsdom without mocking R3F; leave untested with a comment.

- **Existing tests** (`demo-tracks.test.ts`) — unchanged.

## Migration / compatibility

- `LockOnPrototype.tsx` continues to render its bootstrap lockon scene when `RAIL_MODE` is false. Existing behaviour preserved.
- `lockOnStore.ts`'s public API gets a `playerPos` parameter on `tick()`, a new `recyclePassed(playerArcLength, totalArcLength)` action, and a new `setSpline(spline)` action. `LockOnTarget` replaces its `position` field with `anchorT: number` + `offset: [number, number, number]`. Existing tests updated; no consumer outside the scene layer.
- `App.tsx` adds a flag and a ternary. Existing `PROTOTYPE_MODE` behaviour unchanged when `RAIL_MODE = false`.

## Acceptance criteria

1. `npm run dev` boots, defaults to `RailPrototype` on desktop (since `RAIL_MODE=true`).
2. Moving the mouse aims a world-space ray; Space fires a cascade on locked orbs.
3. The camera glides forward along the rail at constant speed, completing the rail in roughly `totalArcLength / RAIL_SPEED` seconds.
4. At any moment, exactly `ORB_WINDOW_SIZE = 6` orbs sit ahead of the player within the tunnel cross-section.
5. Killing a cascade or passing an orb recycles it to a new position ahead of the player.
6. `npm test` passes all four test files (spline, rollingWindow, lockOnStore, railStore).
7. `npm run typecheck` and `npm run lint` pass.
8. The HUD displays `"vr-al-infinite — rail motion prototype (#9)"`.

## Risks and mitigations

- **Far-from-origin float precision** (camera drifts along +Z indefinitely): not a concern for #9 — the rail is finite (`playerT ∈ [0, 1]`) and short (~30 units). If we go to longer rails later, evaluate origin-shift.
- **Camera + HMD pose double-write in VR**: R3F's XR pipeline takes over after the useFrame callback runs. The mover's `camera.position.copy(playerPos)` write is harmless — the XR pipeline replaces it before render. Documented in `RailMover.tsx`'s comment.
- **Stale orb positions during a frame**: `recyclePassed` runs after `tick`, so a frame's `tick` always sees the prior frame's orb list. Acceptable for prototype (one-frame staleness at ~60Hz is imperceptible). Documented; no fix needed.
- **Reusing `randomTargetPosition`'s signature in tests**: existing tests construct target positions directly. They pass `Vector3(0, 0, 0)` as `playerPos` — the player-relative cone math degenerates to the origin-relative form, so the test results are unchanged in behaviour.

## References

- Wayfinder map: #1
- Sibling tickets: #10 (Music Map rail curvature), #11 (avatar revisit), #12 (section-driven velocity)
- Lockon prototype: #6 (defines the existing `lockOnStore`, reticle, cone math)
- Visual baseline: #7 (`docs/visual-baseline.md`)
- Domain glossary: `CONTEXT.md` (Run / Track / Rail / Tunnel / Orb / Music Map)
- Quest 3 perf rules: `docs/research/quest3-webxr-perf.md`
