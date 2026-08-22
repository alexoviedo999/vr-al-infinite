## Agent skills

### Issue tracker

Issues live as GitHub issues in `alexoviedo999/vr-al-infinite`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage labels, unchanged: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Project-specific notes

- **Stack**: Vite + R3F + Zustand + WebXR Device API + drei. Dual-mode (Quest 3 + desktop browser).
- **Quest 3 perf is non-negotiable.** See `docs/research/quest3-webxr-perf.md` — single Canvas, FFR-on, MSAA-off, multiview-on, frameloop=always, dpr=[1,1.25]. Per-frame mutation goes through refs, never `setState`.
- **Audio analysis runs in a Web Worker.** See `docs/research/audio-analysis.md` — essentia.js (WASM, lazy-loaded on upload). Main thread never decodes audio.
- **Fresh glossary.** `CONTEXT.md` defines vr-al-infinite vocabulary explicitly, including how it diverges from Vortexr. Do not import Vortexr's `src/music/MusicMap.ts` interface silently — re-derive from the CONTEXT.md definition.
