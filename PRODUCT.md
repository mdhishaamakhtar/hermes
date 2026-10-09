# Hermes — Design Context

## Project Overview

Hermes is a live polling quiz platform. Hosts create quizzes and run real-time sessions; participants join by code and answer questions live. The platform serves a broad audience — classrooms, corporate teams, and live events alike.

## Design Context

### Users

Anyone, anywhere: a teacher running a classroom formative assessment, a facilitator running a team trivia session, an event host polling a live audience. The host is typically one focused, technically-comfortable person; the participants are a mixed crowd who need to act quickly and read the screen from a distance. Design must work for both simultaneously.

### Brand Personality

**Energetic, playful, live.**

Hermes is the god of speed. The interface should feel like something is always happening — like you caught it mid-broadcast. Not casual, not corporate: urgent, electric, and a little dramatic. It earns attention.

### Aesthetic Direction

- **Dark mode only.** The stage is video black (#101010) with true-grey surfaces built on broadcast video levels. No light mode.
- **Terminal as a soul, not a costume.** Sharp corners are foundational — don't add retro kitsch. The terminal aesthetic is the underlying structure: monospace type, uppercase labels, pixel-precise borders, phosphor-green-adjacent accent moments. No scanlines.
- **Flat backgrounds, no gradients.** Page and surface backgrounds are flat solid colours — no radial blooms, no linear gradients, no vignettes. Colour contrast and typography carry the weight; gradients dilute that.
- **Control room, not costume.** Hermes is the gallery of a live broadcast. Its identity lives in real instruments that each encode true session state: the tally lamp (standby, on air, off air), the station clock, the key-blue slate before each question, and the host's rundown. No colour bars, CRT glow, or glitch effects.
- **Energetic, not garish.** Three lights carry the show: key blue (the house colour), tally red (on air, right now), standby amber. Keep backgrounds dark so colour pops.
- **Not like Kahoot.** No bright primaries on white, no confetti-for-confetti's-sake. Energy comes from motion, density, and contrast — not noise.
- **Unique.** No direct design references. Hermes should look like nothing else in the category.

### Typography

- **Archivo**, narrowed on its width axis, is the on-screen graphics voice: questions, slates, headlines, the tally. Semi-condensed, a long question fits a projector line at a size the back row can read.
- **Schibsted Grotesk** carries the interface voice: labels, controls, and body copy.
- **Azeret Mono** carries data: join codes, clocks, scores, point values, rank and response totals, plus anything a person types. Its slashed zero keeps `0` and `O` distinct in projected join codes. Use `tabular-nums` (`font-variant-numeric: tabular-nums`) wherever digits update live to prevent layout shift.
- Uppercase + tracked text for section labels, status chips, and CTAs (already established).
- Large, bold weights for question text and scores — players read under time pressure.

### Motion

- Motion (`motion/react`) is in the stack — use it intentionally. Its shared vocabulary lives in `lib/motion.ts`.
- Transitions communicate state: new question arriving, answer locked in, results revealing, timer counting down.
- Enter animations: `fade` for content appearing in place, `rise` for surfaces that arrive, `stageCut` for a new question on the live stage.
- The slate is the one authored moment: a key-blue blind over the question area that rolls down, holds, and rolls back up the way it came. It never covers the header or dock, and lifts the moment the timer starts.
- Never animate for decoration alone. Every motion should tell the user something changed.
- Respect `prefers-reduced-motion` (already implemented in globals.css).

### Color System

All semantic tokens, option colours included, are defined in `globals.css` (`@theme`):

| Token | Value | Use |
|---|---|---|
| `--color-background` | #101010 | Page background (video black, code 16) |
| `--color-surface` | #161616 | Cards, panels (one step above background) |
| `--color-foreground` | #ebebeb | Primary text (legal white, code 235) |
| `--color-primary` | #005fd0 | Key blue: CTAs, the slate, the mark |
| `--color-accent` | #92c1fd | Key light: focus, highlights |
| `--color-tally` | #ec5542 | On air; the last seconds on the clock; faults |
| `--color-warning` | #ffa746 | Standby: the lobby, warming up |
| `--color-option-a` | #e0d653 | Answer choice A (bar yellow) |
| `--color-option-b` | #0fd8da | Answer choice B (bar cyan) |
| `--color-option-c` | #bc8ef4 | Answer choice C (bar violet) |
| `--color-option-d` | #cf6192 | Answer choice D (bar magenta) |

The palette is one system, not a collection: neutrals on broadcast video levels; two hero lights (key blue, tally red) at full gain and every other lamp at one shared, lower gain; and every hue in its own slot on the wheel, at least ~40° from the rest, so no two colours are near-twins. Answers are the colour bars' yellow, cyan, violet and magenta, stepping down in lightness so colour-blind players can tell them apart. Lit lamps (the tally, a filled answer letter) take ink text, never white.

Never use raw hex values in components — always reference semantic tokens.

### Design Principles

1. **Speed over decoration.** Every frame matters in a live quiz. Remove friction first; add delight second. If an element doesn't help users act faster or read clearer, cut it.

2. **The screen is the stage.** During an active session, the interface should feel like a broadcast. Full-bleed, high-contrast, legible from across a room. Hosts and participants should feel the stakes.

3. **Colour earns its place.** Dark backgrounds make every colour hit harder. Use the established palette with confidence — a single well-placed accent is more effective than a rainbow.

4. **Motion tells the story.** Transitions between states (question start, answer lock, reveal, results) should feel satisfying and clear. Choreograph state changes, don't just cut between them.

5. **Broad audience, zero ambiguity.** The interface is used by people of all technical backgrounds, often in real time with no time to figure things out. Every action, state, and label must be instantly understood by someone who has never seen the app before.
