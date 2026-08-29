# Quest 3 WebXR + R3F Frame Budget — vr-al-infinite Vertical Slice

Resolves issue #5. Scope: a 60–90 s reactive-shader tunnel prototype with a rail camera, up to 8 lock-on targets + reticles, and a continuous audio-reactive layer. Meta Quest 3 is the primary target; Quest 2 is a fallback.

## 1. Frame budgets (the hard numbers)

Meta's official WebXR perf workflow doc sets the wall-clock budgets:

- 72 Hz = 13.7 ms / frame
- 90 Hz = 11.1 ms / frame
- 120 Hz = 8.3 ms / frame (Quest 3 only)

Default browser behavior per [WebXR App Framerate Control](https://developers.meta.com/horizon/documentation/web/webxr-frames/): "90 fps on Quest 2 and 72 fps on Quest headsets" (older snapshot — modern Quest 3 supports 90/120 Hz; use `session.updateTargetFrameRate` to set explicitly).

**Recommended design budgets** (leave 0.5–1 ms headroom — when you miss the deadline, Asynchronous TimeWarp reproduces a frame from a stale pose, producing "stuttering animations and black bars"):

| Headset  | Target | Wall-clock | CPU budget | GPU budget | Headroom |
|----------|--------|------------|------------|------------|----------|
| Quest 3  | 90 Hz  | 11.1 ms    | 3.5 ms     | 7.0 ms     | 0.6 ms   |
| Quest 3  | 120 Hz | 8.3 ms     | 2.5 ms     | 5.5 ms     | 0.3 ms   |
| Quest 2  | 72 Hz  | 13.7 ms    | 4.5 ms     | 8.5 ms     | 0.7 ms   |

CPU/GPU split is an estimate — Meta notes "any app logic that takes longer than 2 ms should be considered for optimization," and Quest's tile-based GPUs are usually fragment-bound at this resolution. Verify with the profiling workflow below.

## 2. Per-subsystem budget (Quest 3, 90 Hz target)

| Subsystem             | CPU (est.) | GPU (est.) | Notes |
|-----------------------|-----------:|-----------:|-------|
| Rail camera (spline)  | 0.1 ms     | 0.1 ms     | One matrix update + uniform write. |
| Tunnel shader         | 0.4 ms     | 3.5 ms     | Single fullscreen-ish pass; dominant fragment cost. |
| Lock-on targets (≤8)  | 0.3 ms     | 0.6 ms     | One `<Instances>` (1 draw call). 8 ≈ free. |
| Reticles (≤8)         | 0.2 ms     | 0.4 ms     | Sprites or another `<Instances>`. No per-frame alloc. |
| Audio-reactive layer  | 0.4 ms     | 1.2 ms     | Uniform writes + fragment-side mix. FFT off the render frame. |
| R3F / React / drei   | 1.5 ms     | 0.2 ms     | `useFrame` + reconciler + drei helpers. |
| Browser + TimeWarp    | 0.6 ms     | 1.0 ms     | Compositor + WebXR overhead. |
| **Total**             | **3.5 ms** | **7.0 ms** | |

Quest 2 (72 Hz) bumps the same scene ~25%; call `session.updateTargetFrameRate(72)` on detected Quest 2 and tighten shader work first.

## 3. Recommended R3F architecture

Single `<Canvas>`, single immersive-VR session, **never unmount inside VR** — session tear-down + spin-up is a multi-second spike, the dominant latency hit in any R3F WebXR project.

- `frameloop="always"` — moving experience, demand-mode hurts.
- `dpr={[1, 1.25]}` capped to Quest 3 native per-eye; let drei `<PerformanceMonitor>` lower dpr if frame budget slips.
- `gl={{ antialias: false, powerPreference: "high-performance" }}` — **disable MSAA**, enable FFR via `optionalFeatures: ['high-fixed-foveation-level']` instead. Wireframe tunnel + sparse reticles are ideal for FFR.
- One root `<group>` for the tunnel (no nested React state); `<Instances>` for targets, `<Instances>` for reticles, single `<shaderMaterial>` for the tunnel — ~5 draw calls + tunnel fragment work.
- Lock-on state in a Zustand store; mutate `Instance.matrix` via refs in `useFrame` (never `setState` per-frame).
- Spline camera: precompute curve at boot; `useFrame` samples `curve.getPointAt(t, targetVec)` to a ref. **No per-frame allocations.**
- Audio: run AnalyserNode FFT in `setInterval(..., 16)` *off* the render loop; write the latest FFT to a `Float32Array` ref. Render loop reads once, ships as uniform.
- Three.js negotiates `OCULUS_multiview` automatically once the projection layer is `texture-array`. Meta: "Often, a CPU usage reduction of 25%–50% is possible."

## 4. Top pitfalls (design around from day one)

1. **FFR + intermediate render targets = no perf gain.** Render the tunnel directly to the eye buffer; if you composite via a render target, FFR is silently disabled.
2. **MSAA + WebGL is expensive and partially broken on Quest tile GPUs.** Use FFR (`high-fixed-foveation-level`) instead.
3. **`setState` in `useFrame` murders perf.** Per-frame state lives in refs/Zustand; the only React re-render is on rare lock-on/off events.
4. **TimeWarp recovery is invisible until it isn't.** If you miss the deadline, the compositor reproduces a frame from a stale pose — stutter and black bars at the FOV edge. Keep 0.5–1 ms headroom; do not run at exactly 11.1 ms.
5. **Shader-compile stalls on first immersive frame.** Pre-warm each material on `Canvas.onCreated` via an offscreen render. Otherwise the first VR frame eats ~500 ms.

## 5. Profiling approach

1. **drei `<PerformanceMonitor>` + Stats.js** in dev — shows ms/frame and dpr adjustments, no headset required.
2. **OVR Metrics Tool** (via MQDH) — official per-frame GPU + CPU HUD on Quest.
3. **RenderDoc for Meta Quest** for the bottleneck pass — capture a frame, sort by GPU Duration in Performance Counter Viewer. Use `adb shell ovrgpuprofiler --realtime="29,30"` for vertex vs fragment breakdown.
4. **Chrome `chrome://inspect` over ADB** + `xr.debug` category — captures Browser-side per-frame CPU + Phase Sync.

Meta's iteration rule: *"Make one focused change, then test the result on a headset."*

## 6. Architecture in one sentence

Single `<Canvas>`, single `<shaderMaterial>` tunnel, two `<Instances>` meshes (targets + reticles), Zustand store with ref-based per-frame mutation, FFR-on + MSAA-off + multiview-on, FFT in a separate interval, `<PerformanceMonitor>` lowering dpr before frames drop.

## Sources

- Meta: [WebXR performance optimization](https://developers.meta.com/horizon/documentation/web/webxr-perf/)
- Meta: [WebXR performance optimization workflow](https://developers.meta.com/horizon/documentation/web/webxr-perf-workflow/)
- Meta: [WebXR performance best practices](https://developers.meta.com/horizon/documentation/web/webxr-perf-bp/)
- Meta: [WebXR performance tools](https://developers.meta.com/horizon/documentation/web/webxr-perf-tools/)
- Meta: [WebXR Fixed Foveated Rendering](https://developers.meta.com/horizon/documentation/web/webxr-ffr/)
- Meta: [WebXR App Framerate Control](https://developers.meta.com/horizon/documentation/web/webxr-frames/)
- Meta: [Multiview WebGL Rendering](https://developers.meta.com/horizon/documentation/web/web-multiview/)
- Meta: [Using RenderDoc with Browser](https://developers.meta.com/horizon/documentation/web/webxr-perf-renderdoc/)
- R3F: [Scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)
- R3F: [Performance pitfalls](https://r3f.docs.pmnd.rs/advanced/pitfalls)
