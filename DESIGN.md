---
name: Hermes
description: Live polling quiz platform — broadcast energy in a terminal-precise dark room.
colors:
  midnight-stage: "#0a0a0f"
  booth-charcoal: "#0f1117"
  rule-line: "#1a1f2e"
  overlay-graphite: "#252b3b"
  signal-white: "#f8fafc"
  quiet-slate: "#94a3b8"
  shadow-slate: "#4b5563"
  broadcast-blue: "#2563eb"
  deep-broadcast-blue: "#1d4ed8"
  on-air-sky: "#38bdf8"
  sky-glow: "#7dd3fc"
  go-green: "#22c55e"
  amber-edit: "#d97706"
  deep-amber-edit: "#b45309"
  alert-red: "#ef4444"
  deep-alert-red: "#dc2626"
  option-a-blue: "#2563eb"
  option-b-violet: "#7c3aed"
  option-c-amber: "#d97706"
  option-d-rose: "#e11d48"
typography:
  display:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 8vw, 5rem)"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "normal"
    fontFeature: "tabular-nums"
  headline:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  title:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.1em"
  mono:
    fontFamily: "Geist Mono, Courier New, monospace"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  none: "0"
  sm: "2px"
  md: "4px"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.broadcast-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.none}"
    padding: "1rem 2rem"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.deep-broadcast-blue}"
    textColor: "#ffffff"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.quiet-slate}"
    rounded: "{rounded.none}"
    padding: "1rem 2rem"
    typography: "{typography.label}"
  button-ghost-hover:
    textColor: "{colors.on-air-sky}"
  input-field:
    backgroundColor: "{colors.booth-charcoal}"
    textColor: "{colors.signal-white}"
    rounded: "{rounded.none}"
    padding: "0.75rem 1rem"
    typography: "{typography.body}"
  input-field-focus:
    backgroundColor: "{colors.booth-charcoal}"
    textColor: "{colors.signal-white}"
  surface-card:
    backgroundColor: "{colors.booth-charcoal}"
    rounded: "{rounded.none}"
    padding: "1.5rem"
  interactive-row:
    backgroundColor: "{colors.booth-charcoal}"
    textColor: "{colors.signal-white}"
    rounded: "{rounded.none}"
    padding: "1rem 1.5rem"
  label-eyebrow:
    textColor: "{colors.quiet-slate}"
    typography: "{typography.label}"
---

# Design System: Hermes

## 1. Overview

**Creative North Star: "Stage Lights, Dark Room"**

Hermes is a live broadcast staged in a near-black room. The surround stays flat and silent so the question of the moment — the timer, the answer, the leaderboard delta — can step into the spotlight unchallenged. The atmosphere is theatrical and precise at the same time: a terminal's clarity wearing a broadcaster's stakes. Every element earns its colour because the room behind it doesn't compete.

This system rejects four families by name: the candy-coloured carnival of Kahoot, the rounded-card soft-gradient politeness of generic SaaS dashboards, retro CRT kitsch (scanlines, phosphor bloom, fake noise), and crypto/gaming neon (cyan-on-black, glowing borders, gradient text). The terminal is the *soul* — monospace inputs, uppercase tracked labels, hairline borders — never a costume.

**Key Characteristics:**
- Flat near-black canvas (`#0a0a0f`), one step lighter for surfaces (`#0f1117`). No gradients, no blooms, no glassmorphism.
- Sharp corners as foundational identity. The radius scale exists for completeness; production UI uses `0` almost everywhere.
- One accent at a time — the spotlight metaphor. Signal-white text, quiet-slate context, broadcast-blue for action, on-air sky for liveness.
- Geist Sans for everything visible; Geist Mono reserved strictly for typed user input.
- `tabular-nums` mandatory on every live-updating digit (timers, scores, counts) — the room must not jitter.
- Motion is choreography, never decoration. Enter animations carry meaning (a new question arrives, an answer locks, the reveal lands).

## 2. Colors

A near-black, neutral-tinted dark mode with high-saturation status accents and a four-colour A/B/C/D option palette. The neutrals never tint warm; the accents never run pastel.

### Primary
- **Broadcast Blue** (`#2563eb`): The single CTA colour. Worn by primary buttons, focus rings, the "on" state of interactive controls. Saturated enough to read as action from across a room.
- **Deep Broadcast Blue** (`#1d4ed8`): Hover state for primary. Same hue, two steps deeper — the button presses *into* the dark room rather than lifting off it.

### Secondary
- **On-Air Sky** (`#38bdf8`): Liveness signal. Links, the live-dot, "now happening" accents, hover treatment on ghost buttons. The colour that says *broadcasting*.
- **Sky Glow** (`#7dd3fc`): Hover variant for sky. Lighter, almost vapor.

### Tertiary — Status
- **Go Green** (`#22c55e`): Correct answers, confirmations, "reviewed" badges. Never used decoratively.
- **Amber Edit** (`#d97706`): Edit mode, pending review, passage badges. The "yellow light" state — something is in progress and the operator should pay attention.
- **Deep Amber Edit** (`#b45309`): Hover for amber.
- **Alert Red** (`#ef4444`): Errors, incorrect answers, destructive confirms. Reserved for genuine danger.
- **Deep Alert Red** (`#dc2626`): Hover for danger.

### Neutral
- **Midnight Stage** (`#0a0a0f`): The page canvas. The room.
- **Booth Charcoal** (`#0f1117`): Cards, panels, inputs. Exactly one tonal step above the canvas — discernible but never floating.
- **Rule Line** (`#1a1f2e`): Hairline borders, dividers, the timer track. Visible as structure, not as decoration.
- **Overlay Graphite** (`#252b3b`): Reserved for overlay scrims (modal backdrops, drawer dimming).
- **Signal White** (`#f8fafc`): Primary readable text and display numerals. Tinted toward cool to sit in the neutral family rather than reading warm.
- **Quiet Slate** (`#94a3b8`): Secondary text, eyebrow labels, captions, metadata.
- **Shadow Slate** (`#4b5563`): Disabled state and placeholder text. The "off" register.

### Option Palette (A/B/C/D)
These four are mutually distinct and are reserved exclusively for answer-option identity. They do not appear on chrome.
- **Option A — Broadcast Blue** (`#2563eb`)
- **Option B — Violet** (`#7c3aed`)
- **Option C — Option Amber** (`#d97706`)
- **Option D — Rose** (`#e11d48`)

### Named Rules

**The Spotlight Rule.** At any moment, exactly one colour is permitted to *act*. Everything else is neutral, muted, or status. If two saturated colours are competing for attention in the same view, the design is wrong — pick the one that is on-air and quiet the other.

**The No-Tint-on-White Rule.** There is no white surface in Hermes. Text appears on near-black; primary actions appear on near-black; cards sit on near-black. Any urge to drop a panel onto white means the design has slipped out of the broadcast room.

**The Option Palette Is Sacred.** A/B/C/D colours mean "answer choice." They do not appear in chrome, in marketing surfaces, in icons, or in status messaging. Misusing them dissolves the most important affordance in the product.

## 3. Typography

**Display / UI Font:** Geist Sans (with `system-ui, sans-serif`)
**Mono Font:** Geist Mono (with `Courier New, monospace`) — typed input only

**Character:** Geist Sans is the entire visible voice — for body, headings, scores, timers, leaderboard digits, and large display numerals. Geist Mono never appears as display text; it is reserved as the typewriter behind form fields and the join-code entry. The pairing reads as broadcast-modern, not corporate-bland — geometric without becoming sterile.

### Hierarchy
- **Display** (Geist Sans 900, `clamp(2.25rem, 8vw, 5rem)`, line-height 1): Hero numerals — final scores, the join code on the host screen, the countdown timer. Always `tabular-nums`.
- **Headline** (Geist Sans 700, 1.5rem / 24px, line-height 1.3): Question text during play, end-of-session leaderboard heading. Max width 65–75ch for long prompts.
- **Title** (Geist Sans 700, 1.125rem / 18px, line-height 1.4): Stat values, leaderboard scores, secondary headings.
- **Body** (Geist Sans 400–500, 1rem / 16px, line-height 1.6): All paragraph text. Form inputs render at 16px to prevent iOS Safari auto-zoom.
- **Label / Eyebrow** (Geist Sans 600, 0.75rem / 12px, letter-spacing 0.1em, UPPERCASE, colour Quiet Slate): Section labels, status chips, metadata captions. This is the *terminal voice* — clipped, tracked, monospace-adjacent in mood without being mono in family.
- **Field Label** (Geist Sans 500, 0.8125rem / 13px, letter-spacing 0.01em, sentence case): Used only on `<label>` elements above form inputs. Sentence-cased deliberately — uppercase labels above inputs feel hostile.

### Named Rules

**The Tabular Digit Rule.** Every numeric value that updates live — timers, scores, counts, ranks, participant tallies — uses `font-variant-numeric: tabular-nums`. The room must not breathe sideways when a digit ticks.

**The Mono Stays in the Field Rule.** Geist Mono lives inside form inputs, code badges, and typed identifiers (join codes, emails). It does NOT appear in headings, display numerals, scores, or labels. Geist Mono is not a display face and breaks at large sizes.

**The Uppercase Tracked Voice.** Section labels, status chips, button CTAs, and metadata captions are uppercase with 0.1em letter-spacing. Body and headline text are sentence case. The two registers stay separate — never mix uppercase-tracked with sentence-case in the same atom.

## 4. Elevation

**Hermes is flat by doctrine.** There are no `box-shadow` values anywhere in the system. Depth is conveyed by tonal step (Booth Charcoal `#0f1117` sits one step above Midnight Stage `#0a0a0f`) and by hairline borders (Rule Line `#1a1f2e`). The room is a stage, not a diorama — surfaces don't levitate, they're spotlit.

Sticky surfaces (the session header) hold themselves above scrolling content via a 95% background opacity backdrop on the same near-black, never via shadow. Modals and drawers dim the room with an Overlay Graphite scrim — again, no shadow on the modal surface itself.

### Named Rules

**The Flat-By-Default Rule.** Surfaces never cast shadows. If a panel feels like it needs depth, the issue is contrast, border, or grouping — solve it there, not with `box-shadow`. Drop shadows are a tell that the design has reverted to SaaS-dashboard reflexes.

**The Tonal Step Rule.** Exactly three tonal steps exist for surfaces: page (`#0a0a0f`), card (`#0f1117`), inset/border (`#1a1f2e`). Nesting four levels of tonal step is forbidden — if a panel needs to feel "deeper than its container," redesign the hierarchy.

## 5. Components

For every component, the character is "pixel-precise, sharp, broadcast-confident." Hairline 1px borders are the standard structural device. Buttons and inputs do not round.

### Buttons
- **Shape:** Sharp corners (`border-radius: 0`). No exceptions for primary, ghost, or destructive variants.
- **Primary** (`.btn-primary`): Background Broadcast Blue (`#2563eb`), text white, padding `1rem 2rem`, uppercase tracked label typography (0.1em letter-spacing, 0.875rem). Hover slides to Deep Broadcast Blue (`#1d4ed8`) over 150ms. Disabled state drops to 40% opacity.
- **Ghost** (`.btn-ghost`): Transparent background, 1px Rule Line border, Quiet Slate text. Hover shifts the border toward a 50%-mixed Broadcast Blue and text toward On-Air Sky. Used for secondary actions, cancel flows, "Leave session."
- **Focus:** `box-shadow: inset 0 0 0 2px {colors.broadcast-blue}`. No outline ring — the inset stroke keeps the broadcast-blue identity inside the rectangle.
- **Lock-In Pending** (`.btn-lock-in-pending`): The button maintains full opacity (no fade-to-disabled) and switches to `cursor: wait`. A Framer overlay animates inside the button while the network round-trip resolves. This is the system's signature interaction — the act of locking in must feel suspended, not greyed.

### Chips / Badges
- **Style:** 1px Rule Line border, no fill, `0.5rem 0.75rem` padding, label typography (uppercase tracked).
- **Toned variants:** A status chip can adopt a single tone via `tone="success" | "warning" | "accent" | "danger"`, which colours the text and border (never the fill). Filled chips are forbidden — they fight the spotlight rule.

### Cards / Containers (`surface-card`)
- **Corner Style:** Sharp (`border-radius: 0`).
- **Background:** Booth Charcoal (`#0f1117`) — exactly one tonal step above the page.
- **Border:** 1px Rule Line (`#1a1f2e`) on all four sides. The border *is* the affordance.
- **Internal Padding:** `1.5rem` (`p-6`) default. Dense list rows step down to `1rem 1.5rem`.
- **Nesting:** Forbidden. Never place a `surface-card` inside another `surface-card`. If grouping is needed inside a card, use hairline dividers (`border-t border-border/50`) or background tonal step to Midnight Stage for inset panels.

### Inputs / Fields (`input-field`)
- **Style:** Background Booth Charcoal, 1px Rule Line border, sharp corners, padding `0.75rem 1rem`. Font size 16px (prevents iOS Safari auto-zoom). Placeholder text uses Quiet Slate at 30% opacity.
- **Focus:** Border shifts to Broadcast Blue with an *inset* 1px box-shadow of the same colour — a doubled stroke that reads as "selected, broadcast-blue." No glow, no outer ring.
- **Disabled:** 50% opacity, `cursor: not-allowed`.
- **Typed content:** Inputs accept Geist Mono via the `font-mono` class where the content is identifier-like (join codes, code displays).

### Navigation (the live-session header)
- **Style:** Sticky, full-width, 1px bottom border Rule Line, 95%-opacity Midnight Stage background with `backdrop-blur`. Logo left, status chips + participant count + join-code button right.
- **Typography:** Logo at headline weight, labels uppercase tracked, counts `tabular-nums`.
- **Active states:** A live connection status badge dangles centred below the header — visible but pointer-events-none, dimensioned so it never overlaps interactive controls.

### Leaderboard Row (signature component)
- **Style:** Single-line list-stack, rank + display name + score, score `tabular-nums` and right-aligned.
- **Variants:** `compact` (host sidebar, no avatar), `review` (participant-facing, supports an `isMe` flag that adds a Broadcast-Blue left highlight and bumps the score weight).
- **Motion:** Rows fade-in with a 40ms stagger when leaderboards rebuild. Reordering uses `transitions.spring` (stiffness 200, damping 25).

### Live Dot (signature primitive)
- **Pattern:** A `0.5rem` filled circle (typically Go Green or On-Air Sky) animated via `pulse-dot` (1.5s ease-in-out infinite). Pair with a colour utility class on the dot itself.
- **Use:** Connection status, "live" indicators, "now broadcasting" affordances. Reserved for genuinely-active state; static dots are forbidden — if it's not pulsing, it's not a live dot.

### Loader Orbit
- **Pattern:** A 1px Rule Line ring with an On-Air Sky satellite dot orbiting at 900ms linear. Pair with a soft radial-gradient core blended Accent → Primary → transparent.
- **Use:** Skeleton page loaders and any indeterminate state longer than 200ms. Avoid spinners that look like generic loaders — the orbit is the signature.

## 6. Do's and Don'ts

### Do:
- **Do** keep page backgrounds at Midnight Stage (`#0a0a0f`) — flat, no gradient, no vignette. The room is the room.
- **Do** use `tabular-nums` on every live-updating digit. Timer, score, rank, count, participant total, points awarded.
- **Do** reserve A/B/C/D option colours (`#2563eb`, `#7c3aed`, `#d97706`, `#e11d48`) for answer choices and nothing else.
- **Do** apply one accent at a time per view (the Spotlight Rule). If two saturated colours are competing, redesign.
- **Do** use hairline 1px Rule Line borders as the default structural device.
- **Do** preserve the `btn-lock-in-pending` interaction — full opacity, `cursor: wait`, Framer overlay inside the button. It's the most important micro-state in the product.
- **Do** use Framer's `enterAnimation` (opacity + 8px slide-up over 200ms) for new content arriving on screen.
- **Do** keep Geist Mono inside form fields and code identifiers only.
- **Do** respect `prefers-reduced-motion` — the global CSS rule is in place; don't bypass it with `!important` in component code.

### Don't:
- **Don't** look like Kahoot. No bright primaries on white, no confetti, no cartoon shapes. Hermes is staged, not slapstick.
- **Don't** look like a generic SaaS dashboard. No rounded cards (radius stays `0`), no soft gradient hero panels, no gray-on-color body text. Sharp corners, near-black canvas, signal-white text.
- **Don't** drift into retro CRT kitsch. No scanlines, phosphor bloom, fake noise, or vintage-monitor curvature. The terminal is the *soul* — monospace inputs, uppercase tracked labels — not a costume.
- **Don't** chase crypto / gaming neon. No cyan-on-black glow, no rainbow gradient text, no neon stroke effects. Saturated accents on flat dark, never light-leaks or bloom.
- **Don't** use `box-shadow` on surfaces. Depth comes from the three tonal steps and from hairline borders. Drop shadows are a SaaS reflex.
- **Don't** use gradient text. `background-clip: text` with a gradient fill is forbidden. Emphasis uses weight and size.
- **Don't** nest a `surface-card` inside a `surface-card`. Re-architect the hierarchy.
- **Don't** use Geist Mono for display numerals. It was not designed as a display face and breaks at large sizes — Geist Sans 900 with `tabular-nums` is the correct display digit.
- **Don't** use light mode. Hermes is dark mode only by product doctrine; the token system supports a future light theme behind `[data-theme]` but no surface should be authored for light right now.
- **Don't** introduce raw hex values in components. All colour goes through semantic tokens (`var(--color-*)` in CSS, `colors.*` in `lib/design-tokens.ts`).
- **Don't** animate for decoration. Every motion must communicate a state change. If it could be removed without the user losing information, remove it.
