# assets/demo-tracks

Two user-owned DJ tracks staged for vr-al-infinite development. These
are the demo content the prototype ships with; later audio-pipeline
tickets (R3, see wayfinder map #1) will analyse them into Music Maps.

## Tracks

| Filename | Source | Size | Notes |
|---|---|---:|---|
| `adonis-enter-one.aiff` | `/Users/alexo-macbookpro/Music/Music/DJ/Adonis FR - Enter One (Original Mix).aiff` | 84.5 MB | Also the Vortexr reference track — same song, different project, structural analysis can be cross-checked. |
| `dj-deep-stressed.aiff` | `/Users/alexo-macbookpro/Music/Music/DJ/2024-summer/DJ Deep - Stressed (Original Mix).aiff` | 51.6 MB | |

Sizes recorded 2026-08-22.

## How they're here: symlinks, not copies

Both files are **symlinks** to absolute paths under the user's Music
directory. Rationale:

- The repo has no LFS configured; committing 136 MB of uncompressed AIFF
  would bloat git history irreversibly.
- The source files are user-owned and already canonical on the host
  filesystem. A symlink keeps the repo as a thin pointer and treats the
  user's library as the source of truth.
- For a single-user dev project, the absolute paths are stable enough.

A fresh clone on a different machine (or after moving the source
files) will have broken symlinks. If that becomes a problem, either:
copy the AIFFs in directly and delete the symlinks, or convert to
OGG/MP3 (see "Production deploy" below).

## Vite access path

Vite 5.4's `publicDir` option accepts a single string only (not an
array), so we expose this directory to Vite via a **second symlink**:
`public/demo-tracks → ../assets/demo-tracks/`. Vite's default
`public/` static dir then serves the files at:

```
https://localhost:5173/demo-tracks/adonis-enter-one.aiff
https://localhost:5173/demo-tracks/dj-deep-stressed.aiff
```

`fetch()` against those URLs works from a Worker or `decodeAudioData`
on the main thread. The production build (`npm run build`) copies the
files (following the symlinks) into `dist/demo-tracks/` — `npm run
preview` serves them at the same paths on port 4173.

If `public/demo-tracks` ever breaks (e.g., moved source), recreate it
with: `ln -s ../assets/demo-tracks public/demo-tracks`.

## Copyright & production deploy

Both tracks are **user-owned DJ mixes used for personal development
only**. They are not cleared for redistribution. Before any public
deploy (Netlify / Vercel / GH Pages / Quest Store) the bundle must:

1. Replace these files with permissively-licensed content (CC0 / CC-BY
   electronic tracks), or
2. Move audio behind a "user-must-supply" gate — the prototype already
   has a `Track` definition in `CONTEXT.md` that implies
   user-uploaded audio, so the production code path is the upload
   picker, not a bundled file.

## BPM / key / structure

To be filled in by R3 (audio analysis pipeline). Initial guess:
Adonis "Enter One" is a deep-house / garage cut around 130 BPM;
DJ Deep "Stressed" sits around 124 BPM. Both are tempo-stable enough
for `RhythmExtractor2013` to lock onto per
`docs/research/audio-analysis.md`.
