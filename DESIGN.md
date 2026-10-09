---
name: Hermes
description: Live quizzes, run like a broadcast.
colors:
  background: "#101010"
  surface: "#161616"
  raised: "#1c1c1c"
  border: "#262626"
  border-strong: "#383838"
  foreground: "#ebebeb"
  muted: "#a8a8a8"
  subtle: "#848484"
  faint: "#545454"
  on-primary: "#ebebeb"
  on-primary-muted: "#dce9fc"
  primary: "#005fd0"
  primary-hover: "#0250ae"
  accent: "#92c1fd"
  accent-hover: "#c0dafc"
  tally: "#ec5542"
  danger-solid: "#c13425"
  danger-solid-hover: "#a82418"
  warning: "#ffa746"
  success: "#6dd17f"
  option-a: "#e0d653"
  option-b: "#0fd8da"
  option-c: "#bc8ef4"
  option-d: "#cf6192"
typography:
  display:
    fontFamily: "Archivo, Schibsted Grotesk, sans-serif"
    fontSize: "clamp(3.25rem, 7vw, 7rem)"
    fontWeight: 800
    lineHeight: 0.86
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 72"
  headline:
    fontFamily: "Archivo, Schibsted Grotesk, sans-serif"
    fontSize: "clamp(1.875rem, 4.2vw, 4.5rem)"
    fontWeight: 750
    lineHeight: 1.04
    letterSpacing: "-0.012em"
    fontVariation: "'wdth' 84"
  title:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.1em"
  button:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.08em"
  tally:
    fontFamily: "Archivo, Schibsted Grotesk, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.14em"
    fontVariation: "'wdth' 80"
  data:
    fontFamily: "Azeret Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "'tnum'"
rounded:
  none: "0px"
spacing:
  hairline: "4px"
  row: "6px"
  sm: "8px"
  md: "16px"
  panel: "20px"
  gutter: "24px"
  section: "56px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 20px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.raised}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.danger-solid}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 20px"
    height: "44px"
  button-danger-hover:
    backgroundColor: "{colors.danger-solid-hover}"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "10px 14px"
    height: "44px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.none}"
    padding: "{spacing.panel}"
  option-tile:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "14px 16px"
  option-letter-lit:
    backgroundColor: "{colors.option-a}"
    textColor: "{colors.background}"
    typography: "{typography.data}"
    size: "28px"
  tally-on-air:
    backgroundColor: "{colors.tally}"
    textColor: "{colors.background}"
    typography: "{typography.tally}"
    rounded: "{rounded.none}"
    padding: "0 9px"
    height: "26px"
  tally-standby:
    backgroundColor: "transparent"
    textColor: "{colors.warning}"
    typography: "{typography.tally}"
    height: "26px"
  tally-off-air:
    backgroundColor: "transparent"
    textColor: "{colors.subtle}"
    typography: "{typography.tally}"
    height: "26px"
  slate:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.display}"
    rounded: "{rounded.none}"
    padding: "20px 24px"
  slate-detail:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary-muted}"
    typography: "{typography.data}"
  rundown-cell-done:
    backgroundColor: "{colors.border}"
    textColor: "{colors.subtle}"
    typography: "{typography.data}"
    height: "32px"
  rundown-cell-live:
    backgroundColor: "{colors.tally}"
    textColor: "{colors.background}"
    typography: "{typography.data}"
    height: "32px"
---

# Design System: Hermes

## Overview

**Creative North Star: "The Gallery"**

Hermes is the production gallery of a live broadcast: a flat video-black stage, hairline rules, and a handful of real instruments that each report true session state. The tally lamp says whether the session is in standby, on air, or off air. The key-blue slate drops over the question area to announce the next segment. The rundown shows where the room is in the running order. The station clock keeps the time. None of these is costume; delete the session state behind any of them and the instrument has nothing to say. If a new element cannot name the state it encodes, it does not belong in the gallery.

The palette is built the way a broadcast signal is, not picked from a swatch book. Neutrals are true greys named by their 8-bit video code value, from video black (code 16) to legal white (code 235); nothing is pure black or pure white, which a broadcast chain would clip. Colour is one system with three rules, so no colour is picked on its own. Levels: neutrals are video levels. Gain: two hero lights, key blue and tally red, run at full gain (OKLCH C 0.19); every other lamp (standby, go, the four answers) shares one gain, C 0.15, and the accent sits on key blue's own hue at lower chroma, so they read as a set rather than a collection. Spacing: every hue holds its own slot on the wheel, at least about 40° from any other, so no two lamps are near-twins: tally 30 · standby 65 · A 105 · go 148 · B 196 · key and accent 255 · C 304 · D 354. The four answer colours are the colour bars' yellow, cyan, violet and magenta.

Density is that of a control desk: one stage column, one side rail, a sticky top bar and a sticky dock, everything on hairline-separated flat panels. Energy comes from three lit lamps against video black and from choreographed state changes (the blind rolling down, a stamp landing on an answer letter, ranks sliding), never from gradients, glow, or decoration. Display type is Archivo pulled narrow on its width axis, the voice of on-screen graphics; interface copy is a quiet grotesk; every number a person reads live is monospace with tabular figures. The world is dark only, square-cornered throughout, and flat; it rejects scanlines, CRT effects, terminal costume, the bright-primaries-on-white quiz look, and confetti.

**Key Characteristics:**
- Neutrals are video levels: video black stage, legal white text, true greys between, no pure #000 or #fff.
- Two gains: hero lights (key, tally) at OKLCH C 0.19; standby, go and the answers at C 0.15.
- Fixed hue slots at least ~40° apart: tally 30, standby 65, A 105, go 148, B 196, key 255, C 304, D 354.
- Three lamps carry the show: key blue (house, slate, primary action), tally red (on air, the last five seconds, a fault), standby amber (the lobby, the last ten seconds).
- Answers are the colour bars' yellow, cyan, violet, magenta on a descending lightness staircase, always paired with their A to D letter.
- Every corner is square, status dots included; every surface is a flat fill separated by 1px rules.
- Display type narrowed to 84% / 72% width so a long question fits a projector line.
- Live digits are always Azeret Mono with tabular figures.
- Motion encodes the live moments: blind, stage cut, stamp, slot, tick, drain.

## Colors

True video-level greys carry everything; two hero lights at full gain and a set of lamps at one shared gain are the only colour, each in its own hue slot and each meaning exactly one thing.

### Primary
- **Chroma-Key Blue** (primary, oklch 0.51 0.19 258): hero light, the house colour. The slate, the primary button, the logo mark, the current player's leaderboard row (outline plus 10% fill), the input focus ring, text selection at 55%. It stands 3.2:1 off the stage, so a filled button reads as a shape before it reads as a label. Hover deepens to **Deep Key** (primary-hover, oklch 0.45 0.165 258).
- **Legal White on Key** (on-primary): text on key blue (5.0:1) and on danger-solid (4.7:1).
- **Key Mist** (on-primary-muted, oklch 0.93 0.03 258): secondary text on key blue, tinted from the blue rather than faded white: 4.8:1 on key, where white at 80% would fail.
- **Key Light** (accent, oklch 0.80 0.10 255): the light the key throws, on key blue's own hue slot. Focus outlines (2px, 2px offset), the countdown bar's resting tone, the answered-progress bar, the winner's rank and podium row, the join-code caret, waiting dots, the "You" marker. Hover state **Key Glow** (accent-hover, oklch 0.88 0.055 255).

### Secondary
- **Tally Red** (tally, oklch 0.65 0.19 30): hero light. On air, right now, and a fault, in one hue as a tally lamp is. The lit tally lamp, the live rundown cell while a question is timed, the on-stage rundown outline, the countdown's last five seconds, and every danger signal (wrong answers, errors, invalid fields: the danger token is this same value). Lit tally takes ink text (5.4:1), never white. Filled destructive buttons use **Tally Solid** (danger-solid, oklch 0.54 0.18 30) with legal white, darkening to **Tally Deep** (danger-solid-hover, oklch 0.48 0.17 30).
- **Standby Amber** (warning, oklch 0.80 0.15 65): the lobby and warming up. The standby tally, the countdown from ten seconds down to six, the reconnecting badge, warnings.

### Tertiary
- **Colour Bars** (option-a yellow oklch 0.86 0.15 105, option-b cyan 0.80 0.135 196 (gamut-limited), option-c violet 0.73 0.15 304, option-d magenta 0.64 0.15 354): answers A to D in bar order, at the shared C 0.15 gain, stepping down in lightness left to right. None is red, green or key blue, so an answer never reads as a verdict or as chrome. The lightness staircase is what separates them for colour-blind players: worst all-pairs ΔE (OKLab ×100, dataviz validator) 10.5 deutan, 15.6 normal vision. Ink text on each runs 5.2:1 (magenta) to 12.6:1 (yellow), and the same pairs hold reversed, so a bar colour used as text on the stage also clears 4.5:1. They sit deliberately above the usual dark-mode data-colour lightness band because they double as text and as lit chips under ink text, and they always carry their letter, so colour is never the only cue.
- **Go Green** (success, oklch 0.78 0.15 148): verdicts only. Correct and missed answers, rank climbs, scored badges.

### Neutral
- **Video Black** (background, code 16): the page, input wells, option tiles, leaderboard rows, and the ink text on every lit lamp.
- **Desk** (surface, code 22): panels (stage frame, rundown, standings), dialogs, skeletons.
- **Raised Desk** (raised, code 28): hover fill for secondary and ghost buttons; toasts.
- **Hairline** (border, code 38): the rule between surfaces; the fill of a completed rundown cell.
- **Control Outline** (border-strong, code 56): outlines on inputs, secondary buttons, dialogs, toasts and the off-air tally, so a control stays findable on any surface.
- **Legal White** (foreground, code 235), **Grey 168** (muted), **Grey 132** (subtle), **Grey 84** (faint). Text tiers on the stage / on raised: foreground 16.0:1 / 14.3:1 (reading text), muted 8.0:1 / 7.2:1 (secondary text, labels), subtle 5.1:1 / 4.6:1 (metadata, placeholders; the WCAG AA floor), faint 2.5:1 (disabled only, never information).

### Named Rules
**The Legal Levels Rule.** Neutrals are true greys between video black (#101010) and legal white (#ebebeb). Never pure #000 or #fff as a fill, text or stroke, on screen, in icons, in manifests, or in the social image. (Shadows on floating layers are the one place black appears, as alpha.)

**The Two Gains Rule.** Only the two hero lights, key blue and tally red, run at full gain (OKLCH C 0.19). Every other lamp (standby, go, the four answers) shares C 0.15. The accent family (key light, key glow, key mist) is the key's own light on its hue slot, deliberately lower (C 0.10 and below). A new colour that needs more chroma to read is the wrong colour.

**The Hue Slot Rule.** Every hue holds a fixed slot at least about 40° from any other: tally 30, standby 65, A 105, go 148, B 196, key and accent 255, C 304, D 354. A new lamp needs a free slot or an existing meaning; never a near-twin of a slot already taken.

**The Lamps Mean Something Rule.** Key blue is the house and the action; tally red is now and fault; amber is standby and warning. Never use any of them for decoration, and never use amber outside standby, warning, or the ten-second clock.

**The Colour Bars Rule.** Option colours mean "answer A/B/C/D" and nothing else: no charts, categories, avatars, or accents. They reach components only through the `--option` variable set from the option's position, keep their bar order, hue slots and lightness staircase, and always appear with their letter.

**The Ink On Lit Rule.** A lit lamp (tally on air, a filled answer letter, a live rundown cell) takes video-black ink text, never white. Text on key blue and tally solid uses on-primary; secondary text on key blue uses on-primary-muted, never a faded white.

**The Semantic Token Rule.** Components use the semantic tokens (background, surface, primary, on-primary, tally, option-a...), never the palette values or raw hex. Satori-rendered images, which cannot read CSS variables, mirror the palette by value.

## Typography

**Display Font:** Archivo on its width axis (falling back to Schibsted Grotesk)
**Body Font:** Schibsted Grotesk (with ui-sans-serif, system-ui)
**Label/Mono Font:** Azeret Mono (with ui-monospace)

**Character:** Archivo, narrowed, is the on-screen-graphics voice: dense, upright, legible from the back row. Schibsted Grotesk is the calm interface beneath it. Azeret Mono carries data; its slashed zero keeps 0 and O apart in a projected join code. Where the width axis cannot be driven (the social image), Archivo Narrow 700 stands in.

### Hierarchy
- **Display** (800, 72% width, clamp(3.25rem, 7vw, 7rem) on the landing hero, line-height 0.82 to 0.95, tracking -0.02em to -0.025em): the slate's segment number (up to 8.5rem), landing and end-of-session headlines.
- **Headline** (750, 84% width, clamp(1.875rem, 4.2vw, 4.5rem) on the host stage, line-height 1.04): the question as the room sees it. Phones run clamp(1.625rem, 6.2vw, 2.25rem) at line-height 1.1; multi-question passages drop to 1.25 to 1.5rem.
- **Title** (Schibsted 600, 1rem): panel headings such as Standings.
- **Body** (Schibsted 400, 1rem, line-height 1.6): reading copy; balanced wrap on headings, pretty wrap on paragraphs; passages cap at 72ch, lead paragraphs near 34rem.
- **Label** (Schibsted 600, 0.75rem, 0.1em tracking, uppercase, muted): section names, status, metadata. Buttons use the same voice at 0.8125rem and 0.08em; badges at 0.6875rem and 0.12em.
- **Tally** (Archivo 800, 80% width, 0.75rem, 0.14em, uppercase): the tally lamp only.
- **Data** (Azeret Mono 600, tabular figures): join codes, the station clock, the countdown (2rem on phones, 2.25 to 3rem on the stage), scores, ranks, counts, rundown numbers, the lobby player count (clamp(3.5rem, 9vw, 6rem)).

### Named Rules
**The Narrow Voice Rule.** Display width tightens as type grows: 84% for questions and headings, 72% for the largest slate and hero type. Body text never uses the display face.

**The Tabular Digits Rule.** Any digit that changes while someone watches (clock, countdown, score, rank, count) is Azeret Mono with tabular-nums, so nothing jitters as it ticks.

**The No Kicker Rule.** The uppercase label names a section, status, or datum. It is never placed as a kicker above a heading; the heading carries its own weight.

## Layout

Two frame widths. Organiser and public pages sit in a 64rem (max-w-5xl) column; live session screens use the 80rem (max-w-7xl) stage. The host stage is a two-column grid at xl: a fluid stage column and a 21rem side rail (rundown, then standings) that sticks below the top bar. The player screen is a single 48rem (max-w-3xl) column. The landing page splits copy and a live demo frame (30rem at lg, 34rem at xl).

Gutters are 16px, 24px from sm up. Panels pad 20px; the host stage frame pads 20px, 32px from sm. Leaderboard rows sit 6px apart; rundown cells 4px; stage sections 16 to 24px; lobby and landing blocks breathe at 56px.

Chrome is fixed to edges: a 56px sticky top bar, an optional sticky sub-bar on the player screen (question number, clock, draining bar), and a sticky bottom dock for the session's one action. Both bars are translucent video black (78%) with a 16px blur at 160% saturation, solid under prefers-reduced-transparency. The dock clears the home indicator; the top bar clears the notch; the body clears landscape side insets. The page never rubber-bands (overscroll-behavior: none), and an open dialog stops page scroll.

## Elevation & Depth

Hermes is flat. Depth comes from tonal steps (video 16, 22, 28) and 1px rules, not shadows. Shadows belong only to layers that genuinely float over the page, and they share one token: the modal dialog (over an 82% video-black scrim) and the toast. Z-order is a fixed scale: raised 10, dropdown 100, sticky 200, dock 250, toast 500.

### Shadow Vocabulary
- **Float** (`--shadow-float: 0 24px 48px -12px rgb(0 0 0 / 0.6), 0 8px 16px -8px rgb(0 0 0 / 0.5)`): dialogs, the drawer, and toasts. Nothing else.

### Named Rules
**The Flat Stage Rule.** Page and panel backgrounds are flat solid fills. No radial blooms, linear gradients, or vignettes on any surface. (The only gradients in the build are transient light sweeps across a busy button and a loading skeleton.)

**The Floating Only Rule.** A shadow means the layer floats over the page and will leave. Panels, tiles and frames on the page never cast one.

## Shapes

Every corner is square (0px). Panels, tiles, buttons, inputs, badges, tally lamps, status dots, rundown cells, dialogs and the slate are all hard rectangles; the tally's lamp is a 7px square and every status dot is a square too. Borders are 1px, coloured by role: hairline between surfaces, control outline on controls, the option colour on a chosen answer, dashed for a missed correct answer and for the "you, further down" leaderboard divider. The logo is pixel-built on the same square grid as the icon set.

## Components

### Buttons
Upright, uppercase, and quick under the finger.
- **Shape:** square (0px), 1px border, 44px tall (36px small, 52px large).
- **Primary:** key blue with legal-white uppercase label, 20px side padding; hover deepens to Deep Key.
- **Hover / Focus:** colour shifts at 100ms; a trailing arrow nudges 3px right on hover; press seats the button 1px down; focus is the global 2px key-light outline. A request in flight keeps full strength with a light sweeping across (1.35s loop), distinct from disabled at 40% opacity.
- **Secondary:** transparent with a control outline; hover lights the border key-light at 55% over raised desk. **Ghost:** muted text, raised desk on hover. **Danger:** tally solid with legal white. **Icon:** 36px square, always labelled.

### Badges
- **Style:** square, 1px border at 40% of the tone over a 10% tint, 0.6875rem uppercase tracked label; tones neutral, live (tally), success, warning, danger; optional square status dot, steady like the tally.

### Cards / Containers
- **Corner Style:** square (0px).
- **Background:** desk (surface) panels on the video-black stage.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px hairline.
- **Internal Padding:** 20px.

### Inputs / Fields
- **Style:** a darker well (video black) with a 1px control outline, 16px text (no iOS zoom), 44px minimum height, 10px by 14px padding.
- **Focus:** border and an inset 1px ring in key blue, no outer glow.
- **Error / Disabled:** tally-red border and ring; disabled at 50% opacity.

### Navigation
The top bar is the only navigation: the mark on the left, the context's controls on the right, translucent chrome. On live screens the mark does not link home, so one stray tap cannot pull anyone out of a session.

### Tally (signature)
The lamp over a live camera, and the session's whole state in one word. **Standby** (amber text over a 10% amber tint, lobby), **On air** (filled tally red, ink text, while questions run), **Off air** (subtle text, control outline, hollow lamp, once ended). Steady, never blinking: on air is a state, not an alarm. Colour changes over 240ms.

### Waiting Light
A square 8px light that pulses (opacity and scale, 1.6s) for waiting signals only: a lobby waiting for its first player, a screen waiting on the session. Waiting is a process; a state (tally, badge dot) is shown steady, never flashed.

### Slate (signature)
A key-blue blind over the question area only, announcing the next segment ("Q04" or "Q04–06" in 72%-width display type in legal white, then "of 12 / One answer" in mono in key mist). It appears only when a question arrives with its timer not yet running, so it never costs answering time. It rolls down over 320ms (sheet) on expo-out, holds 1.15s, and lifts over 520ms (lift) ease-in-out: the one exit slower than its entrance, because it uncovers what the room is about to read. It lifts immediately when the timer starts. Header, clock and dock stay visible throughout, and it never takes a click. Reduced motion: it fades.

### Rundown (signature)
The host's running order, one 32px mono cell per question in a 2.25rem auto-fill grid with a "04 / 12" readout. Done cells are filled hairline with subtle text; the on-stage cell is outlined tally red, and filled tally with ink text while its clock runs; upcoming cells wait in outline. Cells change colour over 240ms. Hidden for single-question quizzes.

### Station Clock (signature)
Local time to the second (HH:MM:SS, 24-hour) in muted mono with tabular figures, ticked just after each second turns; on the host's top bar from md up and in the landing demo.

### Answer Option (signature)
One tile for every context: editor, host stage, player, results. A three-column grid (letter, text, aside) on video black with a hairline border, in md, lg (64px) and xl (80px, the projector) sizes.
- **Identity:** the letter square takes the bar colour as a 60% outline and text; when selected or correct it lights solid with ink text.
- **States:** selected (bar-colour border, 14% tint; 22% once locked in), correct (go green border, 12% tint), missed (dashed go green at 55%), wrong (tally red at 65%, 9% tint), dimmed (50% opacity).
- **Stamp:** the letter swaps to a lock on commit and to a tick or cross on reveal, stamped in from 60% scale on a short bouncy spring (0.32s, bounce 0.3).
- **Reveal choreography:** the right answer lights first; dimmed tiles fall back 140ms later, so the eye lands on the answer before the room dims.
- **Response share:** a 22% bar-colour fill grows from the left behind the text on the bar spring.
- **Touch:** a pressed tile gives to 97% scale; hover outlines only on fine pointers.

### Countdown
Mono digits, foreground while running, standby amber at ten seconds or fewer, tally red at five or fewer, where each tick punches in from 112% scale on the tick spring: the one place the stage raises its voice. A 4px drain bar beneath runs on the compositor in key light, amber, then tally red; colour changes over 240ms; under reduced motion it steps each second.

### Leaderboard
Rows keyed by player slide to their new rank on the slot spring; scores roll to new totals; a player who climbed carries a go-green arrow-up mark with the places gained. The viewer's row is outlined key blue; rank one is key light. Final standings reveal third, second, then the winner (larger, key-light tint), with the rest following.

### Motion and Haptics
Durations: instant 100ms (press, hover), base 160ms (state change, most exits), enter 240ms (surfaces arriving, a lamp changing), sheet 320ms (surfaces that travel a long way: the drawer, the slate coming down), stage 480ms (a question cutting in, a podium place landing), and lift 520ms for the slate's exit alone. Curves: expo-out for arrivals, symmetric in-out for moves between two on-screen states, the iOS sheet curve for the drawer. Exits run a step faster than their entrance. A new question arrives as a top-down clip wipe (stage cut). Revealing lists stagger 35ms per row, capped at 280ms; navigational lists never stagger. Reduced motion removes travel but keeps colour and opacity, because those carry picked, correct and wrong. On phones that support it, three moments buzz: picking (6ms), locking in (14ms), and a verdict (a double pulse for points, one dull 32ms thud for none); nothing else does.

## Do's and Don'ts

### Do:
- **Do** give every instrument a true session state: tally from session status, slate from question arrival before the timer, rundown from position, clock from the wall.
- **Do** keep neutrals on the video-level greys, from video black (#101010) to legal white (#ebebeb); run only key blue and tally at C 0.19 and standby, go and the answers at C 0.15, each in its own hue slot.
- **Do** put video-black ink on every lit lamp (tally 5.4:1, colour bars 5.2:1 to 12.6:1); use on-primary on key blue (5.0:1) and tally solid (4.7:1), and on-primary-muted for secondary text on key (4.8:1).
- **Do** keep text on the four tiers: foreground 16.0:1, muted 8.0:1, subtle 5.1:1 (4.6:1 on raised), faint 2.5:1 for disabled only.
- **Do** keep the colour bars in bar order (yellow, cyan, violet, magenta) with their lightness staircase (0.86, 0.80, 0.73, 0.64), and always show the A to D letter beside the colour.
- **Do** set every live digit in Azeret Mono with tabular-nums.
- **Do** keep inputs at 16px text and controls at 44px minimum height.
- **Do** draw durations from the tokens (100 / 160 / 240 / 320 / 480ms, plus the 520ms slate lift) and the springs in the motion vocabulary, mirroring changes between the stylesheet and the motion module.
- **Do** keep hover styles behind (hover: hover) and (pointer: fine), so a phone tap never leaves a tile looking picked.

### Don't:
- **Don't** use pure #000 or #fff as a fill, text or stroke, or fade white with alpha for text on key blue.
- **Don't** use option colours for anything but answers A to D, or reorder them.
- **Don't** use tally red, amber or key blue as decoration, or add a lamp that crowds an existing hue slot.
- **Don't** put gradients, blooms or vignettes on any page or panel background.
- **Don't** add scanlines, CRT glow, or terminal costume.
- **Don't** round corners on any surface, control, lamp, or dot.
- **Don't** blink the tally or a badge dot; pulsing is for waiting signals only.
- **Don't** let the slate cover the header, clock or dock, take a click, or run after the timer has started.
- **Don't** use white text on a lit lamp.
- **Don't** cast shadows from anything that does not float over the page; floating layers use --shadow-float.
- **Don't** place an uppercase label as a kicker above a heading.
