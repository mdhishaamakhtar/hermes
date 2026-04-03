"use client";

import { useEffect, useState, useActionState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import Navbar from "@/components/Navbar";
import { ContentSkeleton } from "@/components/PageSkeleton";

interface Quiz {
  id: number;
  title: string;
  orderIndex: number;
}

interface Event {
  id: number;
  title: string;
  description: string;
  createdAt: string;
  quizzes: Quiz[];
}

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [quizTitle, setQuizTitle] = useState("");
  const [orderIndex, setOrderIndex] = useState(1);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/auth/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) return;
    api.get<Event>(`/api/events/${id}`).then((res) => {
      if (res.success) setEvent(res.data);
      else router.push("/dashboard");
    });
  }, [id, user, router]);

  const handleCreateQuiz = async (_prev: null, formData: FormData) => {
    const title = formData.get("quizTitle") as string;
    const order = Number(formData.get("orderIndex"));
    const res = await api.post<Quiz>(`/api/events/${id}/quizzes`, {
      title,
      orderIndex: order,
    });
    if (res.success) {
      setEvent((prev) =>
        prev
          ? {
              ...prev,
              quizzes: [...(prev.quizzes || []), res.data].sort(
                (a, b) => a.orderIndex - b.orderIndex,
              ),
            }
          : prev,
      );
      setQuizTitle("");
      setOrderIndex((event?.quizzes?.length ?? 0) + 2);
      setShowForm(false);
    }
    return null;
  };

  const [, createQuizAction, creating] = useActionState(handleCreateQuiz, null);

  if (isLoading || !user || !event) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <ContentSkeleton />
      </div>
    );
  }

  return (
    <div className="scanlines min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-12 relative z-10">
        <div className="mb-2">
          <Link
            href="/dashboard"
            className="label hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            ← Dashboard
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mb-10"
        >
          <p className="label mb-1">Event</p>
          <h1 className="text-2xl font-bold text-foreground leading-tight mb-2">
            {event.title}
          </h1>
          {event.description && (
            <p className="text-sm text-muted">{event.description}</p>
          )}
        </motion.div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="label">Quizzes</h2>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-primary text-white px-4 py-2 text-xs tracking-widest uppercase hover:bg-primary-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {showForm ? "Cancel" : "+ Add Quiz"}
          </button>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.form
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              action={createQuizAction}
              className="mb-6 border border-border bg-surface p-5 space-y-4"
            >
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="field-label block mb-2">Title</label>
                  <input
                    name="quizTitle"
                    value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)}
                    required
                    className="input-field font-mono"
                    placeholder="Quiz title"
                  />
                </div>
                <div className="w-24">
                  <label className="field-label block mb-2">Order</label>
                  <input
                    type="number"
                    name="orderIndex"
                    value={orderIndex}
                    onChange={(e) => setOrderIndex(Number(e.target.value))}
                    min={1}
                    className="input-field font-mono"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={creating}
                className="bg-primary text-white px-5 py-2 text-xs tracking-widest uppercase hover:bg-primary-hover disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="h-px bg-border mb-4" />

        {event.quizzes?.length === 0 ? (
          <p className="text-center py-16 text-muted text-sm">
            No quizzes yet. Add one above.
          </p>
        ) : (
          <div className="space-y-px">
            {event.quizzes
              ?.sort((a, b) => a.orderIndex - b.orderIndex)
              .map((quiz, i) => (
                <motion.div
                  key={quiz.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15, delay: i * 0.04 }}
                  onClick={() =>
                    router.push(`/events/${id}/quizzes/${quiz.id}`)
                  }
                  className="group flex items-center justify-between px-6 py-4 bg-surface border border-border hover:border-primary/40 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted tabular-nums w-5">
                      {quiz.orderIndex}
                    </span>
                    <span className="text-foreground font-medium group-hover:text-accent transition-colors text-base">
                      {quiz.title}
                    </span>
                  </div>
                  <span
                    aria-hidden
                    className="text-muted/40 group-hover:text-accent transition-colors select-none"
                  >
                    →
                  </span>
                </motion.div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
