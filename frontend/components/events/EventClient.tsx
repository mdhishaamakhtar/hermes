"use client";

import { useActionState, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { eventsApi } from "@/lib/apiClient";
import { EventDetailSkeleton } from "@/components/PageSkeleton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import BackLink from "@/components/ui/BackLink";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import ResourceRow from "@/components/ui/ResourceRow";
import type { EventSummary } from "@/lib/types";

export default function EventClient({ eventId }: { eventId: string }) {
  const router = useRouter();
  const {
    data: event,
    mutate,
    isLoading,
    error,
  } = useSWR<EventSummary>(`/api/events/${eventId}`);
  const [showForm, setShowForm] = useState(false);
  const [quizTitle, setQuizTitle] = useState("");
  const [confirmQuizId, setConfirmQuizId] = useState<number | null>(null);

  useEffect(() => {
    if (error) router.push("/dashboard");
  }, [error, router]);

  const orderIndex = (event?.quizzes.length ?? 0) + 1;

  const handleCreateQuiz = async (_prev: null, formData: FormData) => {
    const title = formData.get("quizTitle") as string;
    const order = Number(formData.get("orderIndex"));
    const res = await eventsApi.createQuiz(eventId, {
      title,
      orderIndex: order,
    });

    if (res.success && event) {
      const updated = [...event.quizzes, res.data].toSorted(
        (a, b) => a.orderIndex - b.orderIndex,
      );
      mutate({ ...event, quizzes: updated }, { revalidate: false });
      setQuizTitle("");
      setShowForm(false);
    }

    return null;
  };

  const [, createQuizAction, creating] = useActionState(handleCreateQuiz, null);

  const handleDeleteQuizConfirmed = async () => {
    if (confirmQuizId === null || !event) return;
    const id = confirmQuizId;
    setConfirmQuizId(null);
    const res = await eventsApi.deleteQuiz(id);
    if (res.success) {
      mutate(
        { ...event, quizzes: event.quizzes.filter((q) => q.id !== id) },
        { revalidate: false },
      );
    }
  };

  if (isLoading || !event) return <EventDetailSkeleton />;

  const quizzes = event.quizzes.toSorted((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <BackLink href="/dashboard" label="Dashboard" />

      <PageHeader
        label="Event"
        title={event.title}
        description={event.description || undefined}
      />

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
                  defaultValue={orderIndex}
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
        <EmptyState message="No quizzes yet. Add one above." />
      ) : (
        <div className="space-y-px">
          {quizzes.map((quiz, index) => (
            <ResourceRow
              key={quiz.id}
              href={`/events/${eventId}/quizzes/${quiz.id}`}
              ariaLabel={`Open quiz: ${quiz.title}`}
              onDelete={() => setConfirmQuizId(quiz.id)}
              deleteAriaLabel={`Delete quiz: ${quiz.title}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: index * 0.04 }}
            >
              <div className="flex items-center gap-4">
                <span className="font-mono text-xs text-muted tabular-nums w-5">
                  {quiz.orderIndex}
                </span>
                <span className="text-foreground font-medium group-hover:text-accent transition-colors text-base">
                  {quiz.title}
                </span>
              </div>
            </ResourceRow>
          ))}
        </div>
      )}

      <ConfirmDialog
        message={
          confirmQuizId !== null
            ? `Delete "${quizzes.find((q) => q.id === confirmQuizId)?.title}"? All questions and session history for this quiz will be permanently removed.`
            : null
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteQuizConfirmed}
        onCancel={() => setConfirmQuizId(null)}
      />
    </div>
  );
}
