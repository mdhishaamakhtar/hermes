# ✨ Hermes Frontend

> A fast, real-time quiz interface for organisers and participants.

This is the Hermes web client built with **Next.js 16**, **React 19**, **Tailwind CSS 4**, and **Motion**. It handles organiser dashboards, quiz editing, live host controls, participant join flows, and post-session review screens.

---

## 🛠 Tech Stack

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149ECA?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Motion](https://img.shields.io/badge/Motion-13-0055FF?style=for-the-badge&logo=framer&logoColor=white)](https://motion.dev/)
[![Bun](https://img.shields.io/badge/Bun-1.x-FBF0DF?style=for-the-badge&logo=bun&logoColor=black)](https://bun.sh/)
[![STOMP](https://img.shields.io/badge/STOMP-Realtime-111827?style=for-the-badge)](https://stomp.github.io/)

---

## 🔥 Key UI Features

- Organiser dashboard for events, and a quiz editor for standalone questions and reading passages
- Live host stage and player screens with real-time updates over STOMP, including a presenter shortcut (→ or Page Down) to advance
- Join and rejoin flows built for phones: a six-character code, a name, and you're in
- Scoring corrections after grading, with standings that recalculate
- Branded 404 and error pages, and a clear recovery path wherever a request can fail

---

## 🛠 Prerequisites

- **Bun** 1.x ([install](https://bun.sh/docs/installation))

---

## ⚙️ Setup & Development

### Option A: Full Stack via Docker

From the repository root:

```bash
docker-compose up --build
```

This starts the frontend together with PostgreSQL, Redis, RabbitMQ, and the backend.

### Option B: Manual Frontend Development

1. Install dependencies:

   ```bash
   cd frontend
   bun install
   ```

2. Make sure the backend is running at `http://localhost:8080`.

3. Start the app:

   ```bash
   cd frontend
   bun run dev
   ```

Visit [http://localhost:3000](http://localhost:3000).

---

## 🌐 Environment Variables

Create `frontend/.env.local` with:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws-hermes
```

---

## 📂 Structure

- `app/`: routes, layouts, loading states, and the 404 and error pages. Organiser pages share one shell through the `(organiser)` route group.
- `components/`: the shared shell (top bar, page header, providers) and the `ui/` primitives: buttons, fields, dialogs, toasts, icons.
- `features/`: one folder per flow: `auth`, `dashboard`, `events`, `quizzes` (the editor), `join`, `landing`, and `session` (host, play, results, and the live-state reducers).
- `lib/`: the API client, auth and device storage, formatting, and the motion vocabulary.
- `proxy.ts`: the auth gate for organiser routes.

---

## ✅ Development Commands

```bash
cd frontend
bun run dev
bun run build
bun run lint
bun run format
```

---

## 🔗 Links

- [Root Project README](../README.md)
- [Backend Documentation](../backend/README.md)
