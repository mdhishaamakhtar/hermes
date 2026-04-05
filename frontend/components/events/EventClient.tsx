"use client";

import { useActionState, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { api } from "@/lib/api";
import { ContentSkeleton } from "@/components/PageSkeleton";

interface Quiz {
  id: number;
  title: string;
  orderIndex: number;
}

interface EventData {
  id: number;
  title: string;
  description: string;
  createdAt: string;
  quizzes: Quiz[];
}

export default function EventClient({ eventId }: { eventId: string }) {
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [quizTitle, setQuizTitle] = useState("");
  const [orderIndex, setOrderIndex] = useState(1);

  useEffect(() => {
    api.get<EventData>(`/api/events/${eventId}`).then((res) => {
      if (res.success) {
        setEvent(res.data);
        setOrderIndex((res.data.quizzes.length ?? 0) + 1);
      }
      setLoading(false);
    });
  }, [eventId]);

  const handleCreateQuiz = async (_prev: null, formData: FormData) => {
    const title = formData.get("quizTitle") as string;
    const order = Number(formData.get("orderIndex"));
    const res = await api.post<Quiz>(`/api/events/${eventId}/quizzes`, {
      title,
      orderIndex: order,
    });

    if (res.success) {
      setEvent((prev) => {
        if (!prev) return prev;
        const updated = [...prev.quizzes, res.data].toSorted(
          (a, b) => a.orderIndex - b.orderIndex,
        );
        setOrderIndex(updated.length + 1);
        return { ...prev, quizzes: updated };
      });
      setQuizTitle("");
      setShowForm(false);
    }

    return null;
  };

  const [, createQuizAction, creating] = useActionState(handleCreateQuiz, null);

  if (loading || !event) return <ContentSkeleton />;

  const quizzes = event.quizzes.toSorted((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-2">
        <Link
          href="/dashboard"
          prefetch
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
        <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight mb-2">
          {event.title}
        </h1>
        {event.description && (
          <p className="text-sm text-muted">{event.description}</p>
        )}
      </motion.div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="label">Quizzes</h2>
        <button
          onClick={() => setShowForm((value) => !value)}
          className="bg-primary text-white px-4 py-2 text-sm tracking-widest uppercase hover:bg-primary-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
                  onChange={(eventObj) => setQuizTitle(eventObj.target.value)}
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
                  onChange={(eventObj) =>
                    setOrderIndex(Number(eventObj.target.value))
                  }
                  min={1}
                  className="input-field font-mono"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={creating}
              className="bg-primary text-white px-5 py-2 text-sm tracking-widest uppercase hover:bg-primary-hover disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="h-px bg-border mb-4" />

      {quizzes.length === 0 ? (
        <p className="text-center py-16 text-muted text-sm">
          No quizzes yet. Add one above.
        </p>
      ) : (
        <div className="space-y-px">
          {quizzes.map((quiz, index) => (
            <motion.div
              key={quiz.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: index * 0.04 }}
              className="group"
            >
              <Link
                href={`/events/${eventId}/quizzes/${quiz.id}`}
                prefetch
                className="flex items-center justify-between px-6 py-4 bg-surface border border-border hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs text-muted tabular-nums w-5">
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
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
