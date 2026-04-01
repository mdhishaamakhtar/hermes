# hermes — frontend

Next.js frontend for the Hermes live polling quiz platform.

## Setup

Requires [Bun](https://bun.sh/) (`curl -fsSL https://bun.sh/install | bash`).

```bash
bun install
```

## Development

```bash
bun run dev        # Dev server at http://localhost:3000
```

Requires the backend running at `http://localhost:8080`. Use `docker-compose up postgres redis rabbitmq backend` from the repo root to start dependencies only.

## Commands

```bash
bun run dev            # Dev server
bun run build          # Production build
bun run lint           # ESLint auto-fix
bun run format         # Prettier auto-fix
```

## Environment Variables

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws-hermes
```

Copy `.env.local.example` to `.env.local` and adjust if needed.
