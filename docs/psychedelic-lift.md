# The Psychedelic Lift

Proposed brief for [#8](https://github.com/alexoviedo999/vr-al-infinite/issues/8). Derived from the #7 visual baseline (not a live grilling session). Reopen #8 if any axis should be thrown out.

vr-al-infinite stays a wireframe cyberspace tunnel in one neon hue. The lift is not "more particles" — it is the same scene becoming a literal reading of the Music Map and of the player's lock-on cascade, in ways Rez does not.

## Visual reactivity

1. **Section colour temperature (input: Music Map section; response: fog + tunnel hue shift; frequency: at section boundaries only).** Intro is cold cyan, drop saturates, breakdown desaturates. Differs from Rez: Rez tints by *area*, not by the structure of the Track the player uploaded.
2. **Cascade bloom (input: lock-on fire; response: radial wireframe ring + pentatonic Chime; frequency: every cascade).** Visual-baseline pillar 5. Differs from Rez: the bloom scale tracks chord size (1 lock is quiet; 8 locks fills periphery).
3. **Beat-grid pulse on tunnel rings (input: Beat Grid; response: ring scale 1→1.06 on downbeat; frequency: every beat).** Discrete, not FFT. Differs from Vortexr's pre-baked vis: the pulse is generated from the *uploaded* Track's Beat Grid, not a choreographed clip.

Highest-risk to prototype first: **(1) section colour temperature** — cheapest, Music Map already exists, proves "the Track is driving the world" before any warping.

## Geometry warping

1. **Tunnel punch on cascade (input: fire; response: the nearest tunnel ring's radius eases out then back; frequency: per cascade).** Thumper-style impact as shape, not light. Differs from Rez: kills do not currently deform the world.
2. **Section-boundary inflection (input: Music Map startT; response: spline knot).** Seam already exists (`injectSectionInflections`); currently ships curvature-zero because Catmull-Rom jerks. Next map: a different interpolant, or inflections as *visual-only* offsets on tunnel meshes so the rail stays smooth.
3. **Kaleidoscopic mirror only at section transitions (input: section change; response: 200–400ms bilateral duplicate of tunnel rings).** Sayonara-style, then back to single-hue. Differs from Rez: Rez never mirrors the tunnel.

Highest-risk to prototype first: **(2) visual-only inflections** — the rail-jerk problem is already known; decoupling warp from camera motion is the experiment.

## Synesthesia expansion

1. **Shot → Chime (input: cascade member; response: pentatonic one-shot, oldest-lock = lowest pitch).** Already in the first shooting pass as a placeholder. Next: quantize to the Beat Grid so a late shot waits for the next beat.
2. **Head yaw → stereo / filter (input: HMD/camera yaw; response: Chime pan + a gentle low-pass).** Differs from Rez: Rez's mix is not head-tracked.
3. **Lock count → tunnel density (input: number of currently locked orbs; response: extra faint rings fade in).** Differs from Rez: lock stacking is visual on the *targets*, not on the world.

Highest-risk to prototype first: **(1) Beat-Grid-quantized Chimes** — it is the destination's "player is in the arrangement" claim, and it fails obviously if the quantization feels laggy.

## Out of scope here

Implementation of the lift (next map). This document is the ticket list that map should cut from.
