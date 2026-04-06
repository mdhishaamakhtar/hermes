"use client";

import { useActionState, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useSWR from "swr";
import { eventsApi } from "@/lib/apiClient";
import { EventListSkeleton } from "@/components/PageSkeleton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import ResourceRow from "@/components/ui/ResourceRow";
import type { EventSummary } from "@/lib/types";

export default function DashboardClient() {
  const {
    data: events,
    mutate,
    isLoading,
    error,
  } = useSWR<EventSummary[]>("/api/events");
  const [showForm, setShowForm] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const handleCreate = async (_prev: null, formData: FormData) => {
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const res = await eventsApi.create({ title, description });
    if (res.success) {
      mutate([res.data, ...(events ?? [])], { revalidate: false });
      setShowForm(false);
    }
    return null;
  };

  const [, createAction, creating] = useActionState(handleCreate, null);

  const handleDeleteConfirmed = async () => {
    if (confirmId === null) return;
    const id = confirmId;
    setConfirmId(null);
    const res = await eventsApi.delete(id);
    if (res.success) {
      mutate(
        (events ?? []).filter((event) => event.id !== id),
        { revalidate: false },
      );
    }
  };

  if (isLoading) return <EventListSkeleton />;

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-sm text-danger">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <PageHeader
        label="Organiser"
        title="Events"
        action={
          <button
            onClick={() => setShowForm((value) => !value)}
            className="bg-primary text-white px-6 py-2.5 text-sm tracking-widest uppercase hover:bg-primary-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {showForm ? "Cancel" : "+ New Event"}
          </button>
        }
      />

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            action={createAction}
            className="mb-8 border border-border bg-surface p-6 space-y-4"
          >
            <div>
              <label className="field-label block mb-2">Title</label>
              <input
                name="title"
                required
                className="input-field"
                placeholder="Event title"
              />
            </div>
            <div>
              <label className="field-label block mb-2">Description</label>
              <textarea
                name="description"
                rows={2}
                className="input-field resize-none"
                placeholder="Optional description"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="bg-primary text-white px-6 py-2.5 text-xs tracking-widest uppercase hover:bg-primary-hover disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {creating ? "Creating..." : "Create Event"}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="h-px bg-border mb-8" />

      {(events ?? []).length === 0 ? (
        <EmptyState
          message="No events yet"
          hint="Create your first event to get started"
        />
      ) : (
        <motion.div className="space-y-2">
          <AnimatePresence>
            {(events ?? []).map((event, index) => (
              <ResourceRow
                key={event.id}
                href={`/events/${event.id}`}
                ariaLabel={`Open event: ${event.title}`}
                onDelete={() => setConfirmId(event.id)}
                deleteAriaLabel={`Delete event: ${event.title}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, delay: index * 0.04 }}
                layout
              >
                <h2 className="text-foreground font-medium group-hover:text-accent transition-colors">
                  {event.title}
                </h2>
                <p className="text-xs text-muted mt-1">
                  {event.quizzes.length} quiz
                  {event.quizzes.length !== 1 ? "zes" : ""} ·{" "}
                  {new Date(event.createdAt).toLocaleDateString()}
                </p>
              </ResourceRow>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <ConfirmDialog
        message={
          confirmId !== null
            ? `Delete "${(events ?? []).find((e) => e.id === confirmId)?.title}"? All quizzes, questions, and session history will be permanently removed.`
            : null
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}
