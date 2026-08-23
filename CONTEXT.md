# vr-al-infinite

VR/Web Rez-clone: a fixed-rail shooter through a wireframe cyberspace
tunnel, driven by user-uploaded music. The player flies a Rail through a
reactive Tunnel and shoots Orbs in time with the Track, where hits
become musical notes (Chimes) added to the arrangement.

## Language

### The experience

**Run**:
One playthrough, from the first beat of a Track to its last. A Run has
the same duration as the Track that drives it.
_Avoid_: level, game, session, stage.

**Track** (diverges from Vortexr):
The single piece of music a Run is built from. **In vr-al-infinite the
Track is always user-uploaded** — there is no curated library in the
prototype. The Track owns the Run's length and structure, and is the
input to Music Map extraction (see below).
_Avoid_: song, soundtrack, level.

**Rail**:
The fixed path the player travels along for the duration of a Run. The
player controls where they look and aim, never where they go.
_Avoid_: spline (that's the implementation), path, track.

**Tunnel**:
The enclosing geometry the Rail passes through, and the surface most of
the reactive visuals live on.

### Music structure

**Music Map**:
The pre-known structure of a Track — its tempo, Beat Grid, Sections
and energy contour — available in full before playback starts.
Extracted once per upload by essentia.js in a Web Worker (see
`docs/research/audio-analysis.md`). Being known in advance is the
defining property: it is what allows the visuals to anticipate a
musical moment rather than react to it.
_Avoid_: analysis, AI analysis, metadata.

**Beat Grid**:
The timestamps of every beat in a Track, with bar and phrase positions
attached, so any moment can be addressed musically ("bar 33, beat 1")
rather than only in seconds.

**Section**:
A named stretch of a Track with a musical identity — intro, build,
drop, breakdown. Section boundaries are the moments the Run is allowed
to change character.
_Avoid_: level, stage, phase, segment.

**Playhead**:
The current position within the Music Map during a Run — which beat,
which bar, which Section, and how far into it.

### Interaction

**Orb**:
A shootable object floating in the Tunnel. Orbs are the only thing the
player can affect.
_Avoid_: enemy, target, obstacle.

**Lock-on** (Rez-faithful, **not** in Vortexr's glossary):
The state where the player's reticle is held on an Orb. While locked,
the Orb is the player's selected target; releasing the trigger fires.
Multiple Orbs may be locked at once for a chord-style hit. The exact
algorithm (cone vs radius, target priority ordering) is fog — see the
wayfinder map.

**Chime**:
The pitched one-shot that sounds when an Orb is destroyed, aligned to
the Beat Grid and constrained to a scale. It is the player's voice in
the arrangement, not a sound effect.
_Avoid_: hit sound, SFX, note.

**Reactive layer**:
Visual behaviour driven by live frequency analysis of the
currently-playing audio — texture and moment-to-moment life. Distinct
from Music Map-driven behaviour, which is choreographed in advance. In
the prototype the FFT runs on `setInterval(16)` off the render loop and
is shipped to the shader as a uniform ref.

## Divergences from Vortexr (recorded explicitly)

| Term | vr-al-infinite | Vortexr |
|---|---|---|
| Track | User-uploaded (no curated library) | Pre-known, baked into the demo |
| Lock-on | First-class mechanic (Rez-faithful) | Absent |
| Hit→note musical mapping | Rez-faithful (scale-locked Chimes) | Same term but tuned differently |
| Rail input | Free aim, no held implement | Staff pointer drives the origin of shots |
| Vitality | TBD — fog in the wayfinder | Defined |
| Shockwave | TBD — fog in the wayfinder | Defined |

This is a fresh project, not a port. Use vr-wizard-shooter for code and
performance patterns only where they transfer (R3F perf rules in
particular), never for glossary.
