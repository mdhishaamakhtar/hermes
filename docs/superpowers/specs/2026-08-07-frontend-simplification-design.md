# Frontend Simplification — Design

**Date:** 2026-08-07
**Branch:** `refactor/frontend-simplification`
**Scope:** `frontend/` only. No backend changes.

## Problem

The frontend is ~12,500 lines. Its visual design is good and its WebSocket layer works
well, but the code around them has accumulated three recurring defects:

1. **Values defined in multiple places, drifting.** Colours, durations, and geometry
   each have two-to-four definition sites with no mechanism keeping them equal.
2. **Layers that only forward.** Three modules sit between a component and an HTTP
   request; two of them mostly rename things.
3. **A design system that documents more than it delivers.** Roughly 200 lines of
   `globals.css` define, and carefully comment, utilities that nothing uses.

These are one bug wearing three costumes: duplication with no single source of truth.
Symptoms recur because past fixes treated the symptom.

### Evidence

**Motion contradicts itself numerically.**

| Concept | `globals.css` | `lib/design-tokens.ts` |
|---|---|---|
| base | `--duration-base: 150ms` | `transitions.base: 0.2` (200ms) |
| slow | `--duration-slow: 250ms` | `transitions.slow: 0.3` (300ms) |

The `transitions` object is used **once** in the entire codebase
(`transitions.base`). Its other six presets are dead. Meanwhile ~25 hardcoded
duration literals are scattered inline across components: `0.12`, `0.15`, `0.18`,
`0.2`, with per-index delays of `0.03` and `0.04`.

**Three entrance systems coexist.** CSS `.page-enter` plus `.page-enter-delay-1..5`
(4 pages), Framer `enterAnimation` (35 uses), and ad-hoc inline motion props
everywhere else.

**Two consecutive commits installed opposing entrance philosophies.** Commit
`032341d` changed lists to "a plain 150ms fade — no y-translate, no stagger" and made
`PageHeader` static. But `enterAnimation` — `initial: { opacity: 0, y: 8 }` — remains
the default in 35 other places. The codebase currently disagrees with itself about
whether content slides.

**Skeleton geometry is hand-copied from real components.** `PageSkeleton.tsx`
replicates the pixel dimensions of the components it stands in for:

- `RowSkeleton` hardcodes `px-6 py-4 border border-border bg-surface`, mirroring
  `ResourceRow`'s `px-6 py-4 bg-surface border border-border`.
- `EventListSkeleton`'s header hardcodes `mb-1`, `h-8 md:h-9`, `mb-6 sm:mb-10`,
  mirroring `PageHeader`'s `mb-1`, `text-2xl md:text-3xl`, `mb-6 sm:mb-10`.

Commit `032341d` was a manual re-sync of exactly these numbers (`h-4` → `h-6`,
`mb-2` → `mb-1`). Nothing prevents the next `PageHeader` style change from
desynchronising them again and reintroducing the flicker.

**Dead code, confirmed by usage count across all `.tsx`:**

| Symbol | Real uses |
|---|---|
| `surface-card` utility | 0 |
| `interactive-row` utility | 0 |
| `.loader-orbit` / `.loader-ring` / `.loader-core` | 0 real — used only by the dead `Spinner.tsx` |
| `@keyframes fade-in` | 0 |
| `--radius-none` / `-sm` / `-md` | 0 (not even within CSS) |
| `--option-{a..d}-color` | 0 |
| `--option-{a..d}-rgb` | 0 |
| `@theme --color-option-{a..d}` | 0 |
| `colors` export (`design-tokens.ts`) | 0 |
| `zIndex` export | 0 |
| `breakpoints` export | 0 |
| `components/Spinner.tsx` | 0 (never imported) |

`interactive-row` is notable: it is unused *while* `ResourceRow` hand-rolls the same
visual treatment. `surface-card` ships with a documented rule ("Do NOT nest
surface-card inside surface-card") that no code could violate.

The `line-reveal` utility and its keyframe are **live** (`app/page.tsx`) and are
retained. The `loader-*` block is reachable only through `Spinner.tsx`, which nothing
imports, so both are removed together.

**Option colours have four definition sites; only one is live.** `--palette-option-*`,
`@theme --color-option-*`, `--option-*-color` + `--option-*-rgb`, and `OPTION_META`
in TypeScript. Only `OPTION_META` is referenced by components. The entire CSS side
(12 variables) is dead. `lib/session-constants.ts` adds a fifth hop as a pure
pass-through re-export of `OPTION_META`.

**The API is three layers deep with two error conventions.**
`lib/api.ts` (ky + envelope unwrap + 401 redirect) → `lib/apiClient.ts` (named
endpoint objects) → `lib/fetcher.ts` (SWR wrapper that re-unwraps the same envelope).
`apiClient` returns `{ success, data, error }` for callers to branch on; `fetcher`
throws `FetchError`. Both describe the same failures differently.

**The tree has two schemes for one domain.** Session code lives in both
`components/session/` and `features/session/`. Two files are named `QuestionCard.tsx`;
one is a quiz *editor*, the other a live-session display.

**By contrast, what is genuinely good** — and must be preserved: no raw hex appears in
any component; the heavily-adopted utilities `label` (203 uses), `skeleton` (81),
`input-field` (27), `field-label` (24), and `btn-primary` (16); the STOMP layer; and
the visual design language.

## Principle

**One source of truth per concern.** Where a value must exist in two languages
(CSS and TypeScript), one side is declared authoritative and the other mirrors it at a
single documented location — never at each call site.

**Delete before adding.** The token system's problem is not missing tokens. It is
aspirational tokens that nothing uses, sitting beside real duplication that nothing
prevents.

## Constraints

Decided with the user before design:

- **WebSocket behaviour is untouchable.** `useStompClient.ts` internals, subscription
  and destination handling, ack timeouts, reconnect, and session reducer *behaviour*
  are preserved exactly. The two session hooks may be split into modules only with
  identical logic, identical ordering, and identical effects.
- **Skeleton logic is preserved.** When a skeleton appears, for how long, and which
  shape maps to which route stays exactly as-is. Only the source of its geometry and
  its internal composition change.
- **No new runtime dependencies.**
- **The visual design language does not change.** This work makes the design system
  honest, not different.

## Stages

Ordered by value density and ascending risk. Each stage is one commit, independently
verifiable and revertable.

### Stage 1 — Purge dead code, consolidate tokens

Delete everything in the table above. `globals.css` becomes the sole source for
colours, durations, easings, and z-index — with one documented exception, below.

- Remove `colors`, `zIndex`, `breakpoints` from `design-tokens.ts` (zero uses; the
  `colors` block also carried a "must stay in sync" comment, i.e. a known drift risk).
- **Option colours are the documented exception.** Their only consumer is TypeScript,
  which needs `rgb` triplets to build dynamic `rgba()` values in Framer Motion props —
  something CSS variables cannot supply to JS. So `OPTION_META` becomes authoritative
  for option colours, and all 12 dead CSS variables plus the `@theme` option colours
  are removed. This is a single definition site, not a mirror: nothing in CSS restates
  these values, so there is nothing to drift.
- Delete `lib/session-constants.ts`; `WS_ACK_TIMEOUT_MS` moves adjacent to the session
  code that uses it, and `OPTION_META` is imported directly.
- Delete `components/Spinner.tsx`.
- Adopt `--z-dropdown` in `CustomSelect` in place of the hardcoded `z-[100]` — the
  same number, now named.

`design-tokens.ts` survives only as what TypeScript genuinely cannot read from CSS.

### Stage 2 — Collapse the API to one layer

- `lib/api.ts` becomes the single module. It unwraps the response envelope internally:
  success resolves to `T`; failure throws a typed `HermesError { status, code }`.
- Delete `lib/fetcher.ts`. SWR consumes `api.get` directly.
- Delete `lib/apiClient.ts`. Endpoint definitions move into the feature that owns them,
  colocated with their callers.
- `SWRProvider`'s `onErrorRetry` branches on `HermesError.status`. The no-retry set
  (401/403/404), the retry cap, and the backoff are unchanged.
- The 401 → clear token → redirect behaviour is preserved exactly, including the
  `skipAuth` carve-out for login.

Call sites convert from `if (!res.success)` to `try`/`catch`. One convention.

### Stage 3 — Unify motion

- CSS tokens remain the numeric source. `lib/motion.ts` exports Framer presets whose
  values mirror those tokens exactly, at one documented location. The 150/200ms and
  250/300ms disagreements disappear.
- **Resolve the entrance contradiction in favour of the flicker fix.** Content
  arriving over cached or loaded data fades only. `y`-translate is reserved for
  surfaces that are genuinely new on screen — modals, drawers, question transitions —
  where movement carries meaning.
- Replace all ~25 inline duration literals with named presets.
- Delete `.page-enter` and `.page-enter-delay-1..5`; those four pages adopt the same
  system as everything else.

### Stage 4 — Remove skeleton drift

Trigger, timing, and per-route shape stay identical. Only the origin of geometry
changes.

`PageHeader` and `ResourceRow` expose their layout shell so that the real component
and its skeleton render the *same* spacing and sizing classes, with the skeleton
substituting a `<Shimmer>` primitive for text nodes. A single `<Shimmer w h />`
replaces the repeated `bg-surface skeleton` divs.

The alignment achieved manually in commit `032341d` becomes structural: a future
`PageHeader` change moves its skeleton with it.

### Stage 5 — Split the session hooks

`usePlaySession.ts` (1,446 lines) and `useHostSession.ts` (1,074 lines) split into
reducer, message builders, and hook modules.

**Pure extraction. No logic changes.** Same functions, same order, same effect
dependencies, same early returns. This stage is isolated precisely because it carries
the highest risk per line and must be verifiable on its own.

### Stage 6 — impeccable audit

Run `/impeccable:impeccable` over the cleaned codebase for standardisation, hierarchy,
accessibility, and responsive review. Fix what it surfaces.

Deferred to this point deliberately: auditing before the duplication is removed would
produce findings against code scheduled for deletion.

### Stage 7 — Consolidate the tree (mechanical)

`features/{session,quizzes,events,dashboard,auth}/` owns components, hooks, and API per
domain. `components/ui/` retains only domain-agnostic primitives. The two
`QuestionCard.tsx` files are disambiguated by role.

**Pure moves and import updates. Zero content changes**, so git rename detection stays
intact and the diff is trivially reviewable. Last, so that no earlier stage's diff is
obscured by relocation.

## Verification

There is no test suite — no Vitest, no Jest, no test files. TypeScript and the
production build are the automated safety net; the browser is the real one.

Per stage:

1. `bunx tsc --noEmit`
2. `bun run build`
3. `bun run lint`
4. Browser walkthrough via the preview tools, with screenshots as evidence.

The walkthrough covers: login → dashboard → create event → create quiz → add question →
start session → join as participant in a second tab → answer → advance question → end
session → leaderboard → review → results.

Stage 5 additionally requires a full live-session run with host and participant tabs
open simultaneously, confirming timer behaviour, answer acknowledgement, lock-in, and
reconnect.

A stage is not complete until its verification has actually been run and its output
observed. Build success alone does not establish that a live session still works.

## Explicitly out of scope

- Backend, of any kind.
- `useStompClient.ts` internals; STOMP subscription, ack, or reconnect semantics.
- Session reducer *behaviour*.
- Skeleton trigger and timing logic.
- The visual design language.
- Adding a test framework (considered and declined; verification is build plus manual
  browser walkthrough).

## Risks

| Risk | Mitigation |
|---|---|
| Session behaviour regresses with no tests to catch it | Stage 5 is isolated, extraction-only, and gets a dedicated two-tab live run |
| Stage 2 touches every call site | TypeScript catches convention changes exhaustively; the 401 path is verified manually |
| Deleting a "dead" token that is used dynamically | Usage confirmed by grep across all `.tsx`/`.ts`/`.css` before deletion; the build is the second gate |
| Stage 7 obscures earlier review | Runs last, contains no content changes |
