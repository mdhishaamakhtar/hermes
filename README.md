# hermes
Live Polling Quiz Platform

## Prerequisites

- [Docker](https://www.docker.com/) — for running the full stack
- [Bun](https://bun.sh/) — for frontend local development (`curl -fsSL https://bun.sh/install | bash`)
- Java 25 + Maven — for backend local development

## Quick Start (Docker Compose)

```bash
docker-compose up
```

Starts PostgreSQL, Redis, RabbitMQ, backend, and frontend. Frontend at http://localhost:3000, API at http://localhost:8080.

## Local Development

### Backend
```bash
cd backend
./mvnw spring-boot:run     # Requires postgres + redis on localhost
```

### Frontend
```bash
cd frontend
bun install
bun run dev                # http://localhost:3000
```

## Frontend Commands

```bash
bun run dev            # Dev server
bun run build          # Production build
bun run lint:check     # ESLint check
bun run lint:fix       # ESLint auto-fix
bun run format:check   # Prettier check
bun run format:fix     # Prettier auto-fix
```

## Backend Commands

```bash
./mvnw clean package       # Build JAR
./mvnw test                # Run tests
./mvnw spotless:apply      # Format code (run before committing)
```

## Environment Variables (Frontend)

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws-hermes
```

## API Docs

Swagger UI: http://localhost:8080/swagger-ui.html (when backend is running)
