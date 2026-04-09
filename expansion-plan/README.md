# Hermes Expansion Plan

## Goals

Evolve Hermes from a single-select, auto-timed quiz runner into a full-featured live assessment platform with:

- Rich question types (multi-select, custom scoring, passage-based questions with sub-questions)
- Mutable answers before timer expiry / lock-in
- Host-controlled question lifecycle (manual timer start, explain-the-answer review window)
- Configurable display modes (live results, blind, code display)
- Post-quiz answer correction with live leaderboard recalculation
- Event sessions: persistent participants across multiple quizzes with cumulative leaderboards

## Principles

- **No patch jobs.** If a feature requires rethinking the data model or WebSocket protocol, do it properly.
- **Sequential implementation.** Each item builds cleanly on the previous — no forward dependencies.
- **Architecture first.** Foundational changes (schema, protocol) appear as their own items before the features that use them.
- **Good defaults, zero learning curve.** New capabilities are opt-in. A host who ignores every new setting gets a sensible experience.
- **Text only.** Images, audio, and video are out of scope. The architecture should not preclude them later.

## Database Migration Strategy

Schema changes were initially applied by temporarily setting Hibernate's `ddl-auto` to `create-drop`, which wiped and rebuilt the database. Now that the core schema is stable, `ddl-auto` is set to `update` to preserve data during development.

## How to Use These Documents

Each item is designed to be implemented independently in a separate Claude session. To onboard:

1. **Read prior items:** If starting at item N, read items 01 through N-1 to understand what's already been done.
2. **Local testing:** Each item includes a "Local Testing" section with exact commands to test your changes using docker-compose.
3. **Docker setup:** The repository includes a `docker-compose.yml` that runs PostgreSQL, Redis, Spring Boot backend, and Next.js frontend. Use it to test everything end-to-end.

### Quick Start for Testing

From the project root:

```bash
# Start all services (postgres, redis, backend, frontend)
docker-compose up

# In another terminal, run backend tests
cd backend && ./mvnw test

# Run frontend linting
cd frontend && bun run lint

# When done, stop services
docker-compose down
```

Backend API: `http://localhost:8080` (Swagger UI at `/swagger-ui.html`)
Frontend: `http://localhost:3000`
Redis: `localhost:6379`
PostgreSQL: `localhost:5432` (credentials in `.env` or docker-compose.yml`)

## Ordered Implementation List

| # | Item | Description |
|---|------|-------------|
| 01 | [Schema redesign](01-schema-redesign.md) | New data model: question types, per-option scoring, passages, sub-questions |
| 02 | [Display mode schema](02-display-mode-schema.md) | Quiz-level default + per-question override for host display mode |
| 03 | [Backend CRUD updates](03-backend-crud-updates.md) | REST API changes for new question types, passages, and scoring |
| 04 | [Frontend quiz editor](04-frontend-quiz-editor.md) | Quiz editor UI for all new question types and configuration |
| 05 | [Answer mutability](05-answer-mutability.md) | Replace-on-submit model, multi-select storage, lock-in flag |
| 06 | [Manual timer + review flow](06-manual-timer-review-flow.md) | Split question lifecycle: display → timer → grade → review → advance |
| 07 | [Grading engine](07-grading-engine.md) | Sum-of-option-scores grading for all question types |
| 08 | [Display mode runtime](08-display-mode-runtime.md) | Enforce display modes in WebSocket broadcast logic |
| 09 | [Answer correction](09-answer-correction.md) | Post-quiz host corrections with leaderboard recalculation |
| 10 | [Frontend host session](10-frontend-host-session.md) | Host UI: new question lifecycle, display modes, correction UI |
| 11 | [Frontend participant session](11-frontend-participant-session.md) | Participant UI: multi-select, answer mutability, passages |
| 12 | [Event session model](12-event-session-model.md) | EventSession entity, participant persistence across quizzes |
| 13 | [Cumulative leaderboard](13-cumulative-leaderboard.md) | Cross-quiz score aggregation within an event session |
| 14 | [Frontend event session](14-frontend-event-session.md) | Full host + participant UI for event session lifecycle |

## Out of Scope

- Media in questions (images, audio, video)
- Speed bonus scoring
- Team-based participation (teams of multiple people sharing one answer)
- Spectator mode
- Question randomisation / per-participant question ordering
- Export / download of results (CSV, PDF)
- Light mode / theming
