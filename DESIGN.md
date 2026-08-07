---
name: Hermes
description: Live polling quiz platform with broadcast energy and terminal precision.
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
    fontSize: "clamp(2.5rem, 8vw, 5rem)"
    fontWeight: 900
    lineHeight: 1
    fontFeature: "tabular-nums"
  headline:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.3
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
    lineHeight: 1rem
    letterSpacing: "0.1em"
  field-label:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.25rem
    letterSpacing: "0.01em"
  mono:
    fontFamily: "Geist Mono, Courier New, monospace"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  none: "0"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.broadcast-blue}"
    textColor: "{colors.signal-white}"
    rounded: "{rounded.none}"
    padding: "1rem 2rem"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.deep-broadcast-blue}"
    textColor: "{colors.signal-white}"
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
  resource-row:
    backgroundColor: "{colors.booth-charcoal}"
    textColor: "{colors.signal-white}"
    rounded: "{rounded.none}"
    padding: "1rem 1.5rem"
  answer-option:
    backgroundColor: "{colors.midnight-stage}"
    textColor: "{colors.signal-white}"
    rounded: "{rounded.none}"
    padding: "0.75rem"
  leaderboard-row:
    backgroundColor: "{colors.booth-charcoal}"
    textColor: "{colors.signal-white}"
    rounded: "{rounded.none}"
    padding: "0.75rem 1rem"
  label-eyebrow:
    textColor: "{colors.quiet-slate}"
    typography: "{typography.label}"
---

# Design System: Hermes

## Overview

**Creative North Star: "Stage Lights, Dark Room"**

Hermes is a live broadcast staged in a near-black room. The surround stays flat and quiet so the question, timer, answer state, or leaderboard delta can take the spotlight. The atmosphere is theatrical and precise at once: terminal clarity carrying broadcaster stakes. Colour is scarce by design, so an active state reads immediately under time pressure.

The implementation is a dark, sharp-edged system built from semantic CSS tokens and a small set of shared utility patterns. The terminal influence appears in uppercase tracked labels, hairline rules, monospace typed content, and deliberate status feedback, not in CRT effects or retro decoration. Surfaces are mostly flat tonal layers, with localized depth where an open dropdown or drawer needs separation.

**Key Characteristics:**
- Flat near-black canvas and charcoal surfaces with a compact neutral range.
- Sharp rectangular controls and 1px borders as the default geometry.
- Geist Sans for interface text and live numerals; Geist Mono for typed identifiers and scoring fields.
- Broadcast blue for action, sky blue for liveness, and a protected A/B/C/D option palette.
- Motion is state communication: fade for content appearing in place, rise for surfaces that genuinely arrive, spring for response bars.

## Colors

The palette is cool, high-contrast, and intentionally restrained: neutrals carry most of the screen while saturated colors identify action, liveness, answer identity, and status.

### Primary
- **Broadcast Blue** (`colors.broadcast-blue`): Primary actions, focus treatment, selected controls, and the participant's current answer state.
- **Deep Broadcast Blue** (`colors.deep-broadcast-blue`): Primary action hover state; it presses the control into the stage rather than adding lift.

### Secondary
- **On-Air Sky** (`colors.on-air-sky`): Links, live participant counts, selected navigation emphasis, and active broadcast signals.
- **Sky Glow** (`colors.sky-glow`): The lighter hover companion for sky accents.

### Tertiary
- **Go Green** (`colors.go-green`): Correct answers, successful completion, and positive score states.
- **Amber Edit** (`colors.amber-edit`): Reconnecting, pending review, passage metadata, and editing attention states.
- **Alert Red** (`colors.alert-red`): Incorrect answers, errors, and destructive actions.

### Neutral
- **Midnight Stage** (`colors.midnight-stage`): Page canvas and inactive answer-option background.
- **Booth Charcoal** (`colors.booth-charcoal`): Cards, rows, inputs, dropdowns, and session surfaces.
- **Rule Line** (`colors.rule-line`): Borders, dividers, timer tracks, and structural separation.
- **Overlay Graphite** (`colors.overlay-graphite`): Available overlay tone; current drawer scrims use a black alpha layer for stronger occlusion.
- **Signal White** (`colors.signal-white`): Primary text, headings, and display values.
- **Quiet Slate** (`colors.quiet-slate`): Supporting text, labels, metadata, and inactive controls.
- **Shadow Slate** (`colors.shadow-slate`): Disabled and lowest-emphasis text.

### Option Palette
- **Option A Blue** (`colors.option-a-blue`): First answer identity.
- **Option B Violet** (`colors.option-b-violet`): Second answer identity.
- **Option C Amber** (`colors.option-c-amber`): Third answer identity.
- **Option D Rose** (`colors.option-d-rose`): Fourth answer identity.

### Named Rules
**The Spotlight Rule.** Let one saturated color act at a time. Keep surrounding controls neutral or muted so the active state wins without visual noise.

**The Option Palette Is Sacred.** A/B/C/D colors mean answer choice. Do not reuse them for chrome, navigation, generic icons, or unrelated status.

## Typography

**Display Font:** Geist Sans (with `system-ui, sans-serif`)
**Body Font:** Geist Sans (with `system-ui, sans-serif`)
**Label/Mono Font:** Geist Sans for labels; Geist Mono (with `Courier New, monospace`) for typed content only.

**Character:** Geist Sans keeps the product broadcast-modern and highly legible. Geist Mono is a functional typewriter register for input, codes, and scoring values, never a decorative display face.

### Hierarchy
- **Display** (900, `clamp(2.5rem, 8vw, 5rem)`, line-height 1): Hero numbers, join codes, timers, and final scores. Use `tabular-nums` whenever the value changes.
- **Headline** (700, 1.5rem, line-height 1.3): Question prompts and major result headings, generally constrained to a readable measure.
- **Title** (700, 1.125rem, line-height 1.4): Page titles, stat values, and secondary headings.
- **Body** (400, 1rem, line-height 1.6): Explanations, descriptions, and default form text. Keep inputs at 16px to avoid mobile browser zoom.
- **Label** (600, 0.75rem, line-height 1rem, `0.1em` tracking, uppercase): Eyebrows, status labels, metadata, and CTA text.
- **Field Label** (500, 0.8125rem, line-height 1.25rem, `0.01em` tracking, sentence case): Labels associated with form fields.

### Named Rules
**The Tabular Digit Rule.** Timers, scores, ranks, counts, and response totals use `tabular-nums` so live updates do not move the surrounding layout.

**The Mono Stays in the Field Rule.** Geist Mono belongs in inputs, identifiers, codes, and scoring fields. It does not belong in headings, display numerals, or general labels.

## Layout

Hermes uses a responsive utility layout rather than a separate grid framework. Organiser pages typically center content in a `max-w-4xl` column; session and result surfaces expand toward `max-w-7xl` when the stage needs room. Auth and focused lobby content use narrower `max-w-3xl` compositions. Common spacing is built from the Tailwind rhythm, with `gap-2` through `gap-6`, `p-4` through `p-8`, and larger page padding at `sm`, `md`, and `lg` breakpoints.

Answer options switch to two columns at `sm`. Session stage/sidebar compositions switch at `xl`. Headers, page titles, and editor layouts grow at `md`. Mobile layouts remain single-column, full-width, and touch-oriented; controls use at least the established 40px lifted tap targets where a compact label would otherwise be too small.

## Elevation & Depth

The default depth model is flat: page, surface, and border tones do most of the work. Most cards and rows use a 1px border rather than a shadow. Two intentional exceptions are present in the implementation: the open `CustomSelect` dropdown uses a layered shadow to clear nearby content, and the `ScoringDrawer` uses a strong shadow while it occupies the edge of the viewport. Sticky headers use translucent background plus backdrop blur.

### Motion Vocabulary
- **Fade:** Content appearing in its existing place (`duration.base`, 150ms).
- **Rise:** A new surface such as a drawer, dropdown, or question arriving with an 8px travel (`duration.enter`, 200ms).
- **Reveal row:** Leaderboard and result rows use an 8px rise with a capped 30ms stagger.
- **Spring bar:** Response bars use a shared spring (`stiffness: 300`, `damping: 32`).
- **Pending sweep:** Lock-in feedback loops a 1.35s linear stripe while the request is unresolved.
- **Reduced motion:** CSS animations and transitions collapse under `prefers-reduced-motion`; key Framer interactions also check reduced-motion where their movement is most consequential.

### Named Rules
**The Movement Must Tell the Truth Rule.** Use fade when cached or existing content appears in place. Reserve travel for something that genuinely arrived, such as a drawer, dropdown, or next question.

## Shapes

The system has no radius scale in its live CSS tokens. Controls, rows, cards, inputs, badges, and session panels are sharp rectangles with 1px borders. Circular geometry is reserved for live status dots and progress indicators. Clipping is used for answer bars, skeletons, and pending overlays so motion stays inside the component boundary.

## Components

The component language is pixel-precise, rectangular, and broadcast-confident. Shared components own their loading geometry where possible so placeholders do not shift the final layout.

### Buttons
- **Primary:** Blue fill, signal-white uppercase tracked text, `1rem 2rem` padding, rectangular shape. Hover uses the deeper blue token; disabled state lowers opacity.
- **Ghost / secondary:** Transparent surface, 1px rule border, muted text, and the same uppercase tracked register. Hover moves the border toward primary and the text toward sky.
- **Focus:** Inset primary stroke or a primary focus ring, depending on the component pattern. Keep focus visible without adding a rounded halo.
- **Lock-in pending:** Preserve full opacity, use a wait cursor, change the label to indicate progress, and animate the contained sweep. This is a functional network state, not a generic disabled state.

### Chips / Badges
- **Style:** Compact uppercase tracked text with a 1px tone-colored border. Current status badges also use a low-alpha tone fill (`bg-success/8`, `bg-warning/8`, `bg-primary/8`, or `bg-danger/8`) to distinguish live states at a glance.
- **States:** Muted, success, warning, accent, and danger. Reconnecting adds a pulsing status dot and polite live-region status.

### Cards / Containers
- **Shape:** Rectangular, generally `border border-border bg-surface`.
- **Padding:** Primary cards use `p-5` to `p-6`; dense resource rows use `px-6 py-4`.
- **Loading:** Page headers, resource rows, and leaderboard rows expose matching skeleton twins. The `Shimmer` primitive replaces content while retaining geometry.

### Inputs / Fields
- **Style:** Full-width surface background, 1px border, `0.75rem 1rem` padding, 16px body text, and no radius.
- **Focus:** Border changes to primary with an inset primary stroke. Disabled fields reduce opacity and block interaction.
- **Typed content:** Apply Geist Mono to join codes, identifiers, and scoring inputs; keep normal prose in Geist Sans.

### Navigation
- **Style:** Sticky full-width bar with a bottom rule, translucent background, backdrop blur, and a centered max-width content row. Logo and wordmark sit left; account actions or session state sit right.
- **Typography:** Wordmark is black-weight, uppercase, and widely tracked. Account actions use the label register; live counts use tabular numerals.
- **Mobile:** Content compresses within the same single-row structure; action hit areas are lifted with vertical padding rather than changing the visual baseline.

### Resource Row
- **Style:** Motion-capable rectangular surface with a full-row link target, title content on the left, and a destructive delete action plus directional cue on the right.
- **State:** Hover raises border contrast and softens the surface; delete remains a separately clickable target above the link layer.
- **Loading:** Skeleton shares the same shell constants as the real row.

### Answer Option
- **Style:** Responsive two-column set of bordered option controls. Each option gets one protected A/B/C/D identity color, a letter marker, readable option text, and an optional response bar.
- **State:** Selected, correct, missed, and incorrect-selected states use tone-aware borders and low-alpha fills. Response bars animate from the origin with the shared spring.

### Leaderboard Row
- **Style:** Single-line rank, display name, and right-aligned score with `tabular-nums`. `compact`, `default`, and `review` variants change padding and type scale while retaining the same geometry.
- **State:** The current participant gets a primary border and subtle primary wash. Revealing lists use the shared staggered rise.

### Live Participant Count
- **Style:** Accent-colored black-weight number paired with an uppercase tracked caption. Inline mode suits headers; stacked mode suits lobbies.
- **State:** Count changes animate vertically through an accessible live region, with reduced-motion fallback to a static number.

## Do's and Don'ts

### Do:
- **Do** keep page backgrounds in the Midnight Stage family and use semantic tokens instead of raw component colors.
- **Do** reserve A/B/C/D colors for answer options.
- **Do** use hairline rule borders as the default structural device.
- **Do** apply `tabular-nums` to values that update live.
- **Do** use Geist Mono only for typed identifiers, form content, and scoring inputs.
- **Do** keep loading twins geometrically coupled to their rendered components.
- **Do** use motion to explain arrival, change, locking, or reveal, and honor reduced-motion preferences.

### Don't:
- **Don't** introduce light surfaces, rounded SaaS cards, confetti, CRT scanlines, fake noise, or gradient text.
- **Don't** reuse the answer palette for navigation, chrome, or unrelated status.
- **Don't** use shadows as the default card treatment; reserve them for localized overlay separation like the dropdown and scoring drawer.
- **Don't** use Geist Mono for display numerals or headings.
- **Don't** animate decoration that does not communicate a state change.
- **Don't** hand-copy skeleton geometry when the source component can expose its layout shell.
