# ✨ Hermes Frontend

> A fast, real-time quiz interface for organisers and participants.

This is the Hermes web client built with **Next.js 16**, **React 19**, **Tailwind CSS 4**, and selective **Framer Motion**. It handles organiser dashboards, quiz editing, live host controls, participant join flows, and post-session review screens.

---

## 🛠 Tech Stack

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149ECA?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-12-0055FF?style=for-the-badge&logo=framer&logoColor=white)](https://www.framer.com/motion/)
[![Bun](https://img.shields.io/badge/Bun-1.x-FBF0DF?style=for-the-badge&logo=bun&logoColor=black)](https://bun.sh/)
[![STOMP](https://img.shields.io/badge/STOMP-Realtime-111827?style=for-the-badge)](https://stomp.github.io/)

---

## 🔥 Key UI Features

- Organiser dashboard for managing events and jumping into quiz editing quickly
- Event and quiz editor flow with route-level server data loading and client-only editing islands
- Live host and player screens with real-time updates over STOMP
- Join and rejoin flows optimized for lightweight participant entry
- Animated interactions where they add value, with lighter CSS motion elsewhere

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

- `app/`: Next.js App Router routes, layouts, and loading states
- `components/`: Shared UI plus route-scoped client components
- `hooks/`: Realtime and client-side hooks
- `lib/`: API clients, auth token storage, and server fetch helpers
- `proxy.ts`: Protected-route auth gate for App Router requests

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
