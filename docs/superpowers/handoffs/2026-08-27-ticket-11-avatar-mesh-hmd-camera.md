# Handoff — Ticket #11: Avatar mesh + HMD-overridable camera

**PR**: #16 (branch `feat/avatar-mesh-hmd-camera`)
**Status**: Open. Static gates green. Desktop + Quest 3 visual smoke pending.

## What shipped

A wireframe bipedal figure (legs, torso, head icosahedron, arm stubs) that travels along the rail. The avatar's head pivot is the camera anchor. Three files changed:

- **NEW** `src/scene/Avatar.tsx` (~140 lines) — geometry + `useFrame` camera driver
- `src/rail/RailMover.tsx` — dropped the `useFrame` camera writes; dropped `useThree`/`useMemo`/`THREE` imports
- `src/scene/RailPrototype.tsx` — mounts `<Avatar />` between `<OrbField />` and `<AimTracker />`

## Design decisions worth remembering

1. **Head WORLD rotation = `camera.quaternion`.** The head is a child of `avatarGroup` (which `lookAt`s the rail tangent each frame). To make the head's world rotation match `camera.quaternion`, the local quaternion must compensate: `headGroup.quaternion = avatarGroup.quaternion⁻¹ · camera.quaternion`. Without the inverse, the head inherits the body's rail-tangent rotation on top of the look direction. See `Avatar.tsx` for the inline math comment.

2. **Render-tree order is load-bearing.** `<Avatar />` mounts BEFORE `<AimTracker />` so `AimTracker.unproject(...)` reads a camera position written this frame. Reordering breaks lock-on aim. The `RailPrototype` docstring spells this out.

3. **VR is free.** `gl.xr` overwrites camera matrices in the render pipeline AFTER `useFrame`. Avatar's writes are harmless in VR — desktop and Quest share one code path.

4. **Geometry constants are module-scope.** `LEG_HEIGHT`, `TORSO_HEIGHT`, `HEAD_Y`, etc. live at the top of `Avatar.tsx` as `const`s so the anatomy reads like a proportion card. All `meshBasicMaterial wireframe` (matches lockon aesthetic, no per-fragment lighting cost).

5. **No tests added.** Existing test pattern in `src/__tests__/` is pure-function unit tests. Avatar is geometry + a `useFrame` side-effect — component tests would need an R3F harness that doesn't exist. Visual verification (desktop + Quest 3) is the established check for #6/#9/#10/#12 components; #11 follows the same boundary.

## How to verify

```bash
npm run typecheck && npm run lint && npm test && npm run build
npm run dev   # desktop smoke: https://localhost:5173/
```

- **Desktop**: wireframe figure visible inside the tunnel, traveling along the rail. Camera POV is from the head. Looking down shows the figure's torso/legs from first-person.
- **Quest 3**: deploy + "Enter VR". Head pivot tracks HMD rotation; body stays rail-aligned. Look down to see own body (first time the user sees themselves in VR).

## Known issues / deferred

- **Visual smoke not yet run by the user** (per PR #16 test plan).
- **No debug toggle.** Avatar is always-on in `RAIL_MODE`. If you need a hide-avatar toggle (e.g., for side-by-side comparison with option 1), add `avatarVisible: boolean` to `tuningStore` and gate the render.
- **Arms are stubs.** No wrist/hand geometry. Future shooting tickets will likely need a hand/controller mount; the wireframe cylinder is a placeholder.
- **No legs articulation.** Both legs are static cylinders. Walking animation is out of scope (the rail is a flying path, not a walking path).
- **Eyes-vs-head mismatch.** `HEAD_Y = 1.5` is the head pivot; the icosahedron centered there has its surface at y ∈ [1.32, 1.68]. The camera sits at the head pivot center (y=1.5), not at the eye line (~y=1.55). Close enough for a wireframe prototype; tighten if it reads as off.

## Suggested next steps

Pick in order of dependency:

1. **#6 follow-up — controller trigger wiring.** The lockon prototype's fire-cascade is keyboard-only. Wiring the Quest controller trigger is the natural next step before shooting tickets.
2. **#13 — first shooting prototype.** Avatar + aim tracker + a controller trigger = a single-ticket scope for the first "feel" pass at shooting.
3. **#14 — essentia.js pipeline.** Filed during #10. Music Map currently ships with all-zero curvature; real curvature from audio is the missing ingredient for the "psychedelic layer" of the Rez-clone pitch.
4. **Tuning pass.** `tuningStore` has accumulated 9 sliders + 4 checkboxes. Consider collapsing the music-map section now that curvature is gone (just the velocity checkbox remains) and renaming "music map" → "velocity profile" once the curvature knob is fully removed from the UI.

## Files to know

| File | Why it matters |
|---|---|
| `src/scene/Avatar.tsx` | The new component. Geometry constants + head-rotation math. |
| `src/rail/RailMover.tsx` | Publishes `playerPosRef` + `tangentRef`. Avatar reads them. |
| `src/scene/RailPrototype.tsx` | Render-tree order is load-bearing; the docstring spells out why. |
| `src/rail/railStore.ts` | Where `playerPosRef` / `tangentRef` / `playerTRef` live. |
| `src/state/tuningStore.ts` | Knobs the DebugPanel writes; RailMover reads `getState()` per frame. |
| `docs/visual-baseline.md` | Reference for the Rez-inspired visual target. |
