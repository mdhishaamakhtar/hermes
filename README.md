<!-- markdownlint-disable MD033 -->

<p align="center">
  <img src="./frontend/public/og-image.svg" alt="Hermes Preview">
</p>

## Hermes

Hermes is a real-time quiz and live polling platform for organisers who need fast room setup, reliable session control, and instant participant feedback.

Create events, build quizzes, host live sessions, let players join with a code, and watch answers and results update in real time.

## What It Does

- Create and manage events, quizzes, and question banks
- Host live quiz sessions with question-by-question control
- Let participants join and rejoin sessions with a lightweight flow
- Stream lobby state, answers, and results over WebSockets
- Review quiz results for both organisers and participants after a session ends

## Tech Stack

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149ECA?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Bun](https://img.shields.io/badge/Bun-1.x-FBF0DF?style=for-the-badge&logo=bun&logoColor=black)](https://bun.sh/)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-12-0055FF?style=for-the-badge&logo=framer&logoColor=white)](https://www.framer.com/motion/)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot-4.0.3-6DB33F?style=for-the-badge&logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![Java](https://img.shields.io/badge/Java-25-007396?style=for-the-badge&logo=openjdk&logoColor=white)](https://openjdk.org/)
[![Spring Security](https://img.shields.io/badge/Spring_Security-6DB33F?style=for-the-badge&logo=springsecurity&logoColor=white)](https://spring.io/projects/spring-security)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-4-FF6600?style=for-the-badge&logo=rabbitmq&logoColor=white)](https://www.rabbitmq.com/)
[![Quartz](https://img.shields.io/badge/Quartz-Scheduler-4B5563?style=for-the-badge)](https://www.quartz-scheduler.org/)

## Quick Start (Docker)

```bash
docker-compose up --build
```

Then open:

- App: [http://localhost:3000](http://localhost:3000)
- API docs: [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)
- RabbitMQ dashboard: [http://localhost:15672](http://localhost:15672)

## Manual Dev Setup

### 1. Start infrastructure

```bash
docker-compose up -d postgres redis rabbitmq
```

### 2. Run backend

```bash
cd backend
./mvnw spring-boot:run
```

### 3. Run frontend

```bash
cd frontend
bun install
bun run dev
```

The frontend expects:

- `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080`
- `NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws-hermes`

## Backend Tests & Coverage

Backend tests use Testcontainers for PostgreSQL, Redis, and RabbitMQ, so Docker must be running.
The project targets Java 25; if your shell defaults to another JDK, pin `JAVA_HOME` for the command:

```bash
cd backend
JAVA_HOME=$(/usr/libexec/java_home -v 25) ./mvnw test
```

The test run also generates the JaCoCo report:

```bash
open target/site/jacoco/index.html
```

For a clean rebuild with tests and coverage:

```bash
cd backend
JAVA_HOME=$(/usr/libexec/java_home -v 25) ./mvnw clean test
```

## Project Docs

- Backend: [backend/README.md](./backend/README.md)
- Frontend: [frontend/README.md](./frontend/README.md)

## Contributor

- Md Hishaam Akhtar

<p align="center">
  Built for live rooms that need instant feedback.
</p>
