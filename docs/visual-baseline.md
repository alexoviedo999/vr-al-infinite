# Visual Baseline Reference Set

A shared language for the aesthetic destination of vr-al-infinite. Captured
during ticket #7 so future shader and art-direction work has a single
frame of reference for both the Rez-faithful starting pole and the
psychedelic pole we eventually want to push toward.

> Source for every local frame: a Rez Infinite screen recording provided
> by the user during #6. Frames were pulled with `ffmpeg` and are 1280px
> wide; the 10×1280 frames at the recording's t={2,6,11,15,19,23,27,31,35,39}s
> timestamps were the candidates, and the seven below were the ones that
> demonstrated distinct visual pillars.

## The aesthetic, in three sentences

vr-al-infinite is a wireframe cyberspace tunnel drawn in a single neon
hue over pure black, where every visual is a literal reading of a
musical signal — hits become light, beats become geometry. The player
is always depicted as a glowing avatar on the rail, never abstracted
behind a dashboard; the HUD lives in the world, not over it. The
discipline is deliberate constraint; the destination, once basic
mechanics feel right, is the same scene made unmistakably psychoactive
without abandoning the wireframe grammar that holds it together.

## Where we start — Rez / Rez Infinite

| # | Frame | Pillar it demonstrates |
|---|---|---|
| 1 | [`01-diegetic-hud.png`](visual-baseline-assets/rez/01-diegetic-hud.png) | **Diegetic HUD**: the reticle lives in 3D space, the player avatar is visible behind it, no fullscreen dashboards. First principle: every UI element must be reachable through world-space geometry before 2D overlays are allowed. |
| 2 | [`02-single-lock.png`](visual-baseline-assets/rez/02-single-lock.png) | **Minimalism + breathing room**: vast empty starfield around a single locked target. The negative space is the aesthetic; clobbering the screen is forbidden until it earns its place per beat. |
| 3 | [`03-chord-stack.png`](visual-baseline-assets/rez/03-chord-stack.png) | **Multi-target lock stacking**: many wireframe silhouettes overlapping behind the reticle, all set to fire together. The cascade is the chord; the screen should "explode" on a multi-hit, not on a single hit. |
| 4 | [`04-sin-wave-bar.png`](visual-baseline-assets/rez/04-sin-wave-bar.png) | **Horizontal sin-wave enemy line**: Rez's signature layout of three-to-five enemies on a roughly-horizontal axis, fanned left/right of the reticle. Anti-pattern: random scatter or vertical stacks. |
| 5 | [`05-kill-flash.png`](visual-baseline-assets/rez/05-kill-flash.png) | **Kill flash as starburst**: when an enemy dies, the screen gets a brief radial particle burst at the kill point. The hit must be visible from the periphery; if the player can miss it in their peripheral vision, the flash is too quiet. |
| 6 | [`06-color-clouds.png`](visual-baseline-assets/rez/06-color-clouds.png) | **Color-coded clouds + concentric wireframe**: enemies and effects are tinted by role (target / locked / hit / area-color), not assigned arbitrary colors per object. The wireframe rings of the tunnel are a hierarchy — far rings are dim, near rings are saturated. |
| 7 | [`07-peak-density.png`](visual-baseline-assets/rez/07-peak-density.png) | **Peak intensity at the breakdown**: the busiest frame in the recording matches the loudest musical moment. Visual density is a faithful ramp of audio density, not a separate choreography. |

## Where we push — psychedelic references

Each row is "the lift we want to perform against the Rez baseline":

| # | Reference | URL | Technique we want to borrow |
|---|---|---|---|
| 1 | **Tetris Effect** (Enhance Games, 2018) | [arstechnica.com review](https://arstechnica.com/gaming/2018/11/tetris-effect-uses-vr-to-drop-puzzle-pieces-directly-into-your-brain/) · [Tetris Effect Connected trailer](https://www.youtube.com/watch?v=XYwrjOgXaWw) | **Volumetric particles as audio channel.** Every block, combo, and line clear detonates a 3D particle field that fills more than the play volume — particles spill into the player's peripheral vision. We want lock-fills, cascades, and section transitions to behave the same way. |
| 2 | **Thumper** (Drool, 2016) | [Official screenshots](https://thumpergame.com/thumper-screenshots/) | **Geometry as impact, not decoration.** Thumper's tunnel-warps beat-for-beat and the impact moments are *shapes that stab at you*, not particle sprays. We want cascades to land as geometry changes (a tunnel segment physically punched) rather than as light shows. |
| 3 | **Sayonara Wild Hearts** (Simogo, 2019) | [Simogo portfolio](https://simogo.com/work/sayonara-wild-hearts/) · [LaunchBox gallery](https://gamesdb.launchbox-app.com/games/images/123518-sayonara-wild-hearts) | **Kaleidoscopic symmetry + vaporwave palette.** The exact opposite of Rez's "one neon hue on black" — Sayonara uses bilateral mirrors, magenta/cyan complementary pairs, and saturation peaks on transitions. We want symmetric moments during section transitions; the rest stays single-hue. |
| 4 | **Rez Infinite — Area X** (Enhance, 2016) | [Wikipedia: Rez Infinite](https://en.wikipedia.org/wiki/Rez_Infinite) (search "Area X") | **Rez pushing past its own ceiling.** Area X is what Rez looks like when it stops holding back — full psychedelic body-hack visuals synced to music, hierarchy dissolves into synesthesia. Our destination pole. |
| 5 | **Shadertoy — "Tunnel Vision" / "Audio Tunnel" / "Glitch Tunnel"** | [Tunnel Vision](https://www.shadertoy.com/view/Xtf3WN) · [Audio Tunnel](https://www.shadertoy.com/view/MlSczh) · [Glitch Tunnel](https://www.shadertoy.com/view/Wt2fzV) | **The moving-base technique.** Raymarched polar tunnels with audio-reactive parameters are the cheapest way to evolve from "wireframe on black" to "psychedelic fluid geometry" without abandoning the tunnel structure. |
| 6 | **Aphex Twin — "Come to Daddy" (Chris Cunningham, 1997)** | [Wikipedia: Aphex Twin videography](https://en.wikipedia.org/wiki/Aphex_Twin_discography#Videography) · [Chris Cunningham filmography](https://en.wikipedia.org/wiki/Chris_Cunningham_(director)) | **Body-horror wireframe portraiture.** Cunningham's Aphex Twin videos are wireframe CGI faces pushed to grotesque extremes. When we eventually render the player's avatar at high intensity (the climax run, the score moment), this is the look we want to study — how wireframe can read as flesh under stress. |
| 7 | **Demoscene — Farbrausch, Black Lotus, Conspiracy** | [Pouet.net](https://www.pouet.net/) · [Wikipedia: Demoscene](https://en.wikipedia.org/wiki/Demoscene) | **Discipline of constraint under no-budget.** The demoscene proves that wireframe vector geometry + a single bold idea + flawless timing beats a million-particle budget every time. Our work has the same constraints (Quest 3 fragment cost, single hue palette). The reference is the craft, not the visuals. |

## Out of scope (so this doc doesn't drift)

- **Shader implementation**: a separate map. This doc anchors *what* the visuals should feel like; shader tickets implement *how*.
- **Defining "more psychedelic" in detail** ([G7], parallel ticket). The lift column above is a directional wishlist, not a specification.
- **Music-reactivity wiring**: tied to audio analysis (essentia.js, music map extraction). The visuals here describe the destination; the audio-side ticket makes them reachable.
- **Sound design / 3D audio**: also a later map. Reference visuals here are silent; sound is a separate layer.

## How to use this doc

- New visual ticket lands → first paragraph ("three sentences") is the test. Does the work fit *that*?
- If the ticket adds a shader or effect → does at least one row in the Rez table still describe its purpose? If not, the work has drifted past the baseline and needs a column migration.
- If the ticket pushes past the baseline → it must add (not replace) a row in the "push" table. The two tables are poles, not a spectrum.

[G7]: see wayfinder map at #1
