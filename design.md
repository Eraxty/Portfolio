# ERAXTY — design system

Concept: an Aperture test chamber run like a race weekend. The 3D world is a dark facility shaft you descend
while scrolling; the UI is an F1 pit-wall timing screen. Both themes come from real projects:
TouchTrack (started in a 4DX seat at the F1 movie) and Mouse-Portal (Portal for your cursor).

## Colour
| token | hex | use |
|---|---|---|
| --bg | #0A0A0B | page, facility void |
| --ink | #ECECE6 | text |
| --mute | #77776F | secondary text |
| --line | rgba(236,236,230,.12) | hairlines, grid |
| --paper | #F1F0EA | the Lab island (Aperture white panels) |
| --blue | #2F9BFF | Portal blue (Wheatley's eye, cursor left half) |
| --orange | #FF7A1A | Portal orange (accents, cursor right half) |
| --purple / --green / --yellow | #B44CFF / #22D16B / #F2D21B | F1 sector states only |

## Type
- Display: Archivo variable, wdth 112 to 125, wght 700 to 850, tracking -0.04em, uppercase for names.
- Body: Archivo wdth 100, 400, 17px / 1.55.
- Telemetry: JetBrains Mono 500, 11 to 12px, uppercase, +0.08em.

## Shape
- Hairlines over boxes. Radius 0 for the timing tower (broadcast graphics are square), 18px for the Lab island.
- Buttons: text with an arrow and an underline that draws in. No pills, no glass, no gradients on surfaces.

## Sections (one thought each)
0. Start lights loader (real load progress, random hold, lights out)
1. Hero: name behind Wheatley, who watches the cursor
2. Statement: one sentence lights up word by word; camera transits a blue portal
3. Work: live GitHub timing tower, sorted by stars, purple = freshest push
4. Lab: a circuit drawn in code; a car laps Idea, Build, Break it, Ship (Level 3)
5. Subject file: about + photos, GLaDOS hangs above and tracks you
6. Parc fermé: contact; a Companion Cube falls through portals onto a button
