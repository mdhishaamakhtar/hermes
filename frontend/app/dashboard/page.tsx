"use client";

import { useEffect, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import Navbar from "@/components/Navbar";

interface Event {
  id: number;
  title: string;
  description: string;
  createdAt: string;
  quizzes: { id: number; title: string; orderIndex: number }[];
}

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/auth/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) return;
    api.get<Event[]>("/api/events").then((res) => {
      if (res.success) setEvents(res.data);
      setFetching(false);
    });
  }, [user]);

  const handleCreate = async (_prev: null, formData: FormData) => {
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const res = await api.post<Event>("/api/events", { title, description });
    if (res.success) {
      setEvents((prev) => [res.data, ...prev]);
      setShowForm(false);
    }
    return null;
  };

  const [, createAction, creating] = useActionState(handleCreate, null);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.delete(`/api/events/${id}`);
    setEvents((prev) => prev.filter((ev) => ev.id !== id));
  };

  if (isLoading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex items-center justify-between mb-10"
        >
          <div>
            <p className="label mb-1">Organiser</p>
            <h1 className="text-2xl font-bold text-foreground leading-tight">
              Events
            </h1>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-primary text-white px-6 py-2.5 text-xs tracking-widest uppercase hover:bg-primary-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {showForm ? "Cancel" : "+ New Event"}
          </button>
        </motion.div>

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

        {fetching ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 bg-surface border border-border animate-pulse"
              />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted text-sm tracking-wide mb-2">
              No events yet
            </p>
            <p className="text-muted/50 text-xs">
              Create your first event to get started
            </p>
          </div>
        ) : (
          <motion.div className="space-y-px">
            <AnimatePresence>
              {events.map((event, i) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, delay: i * 0.04 }}
                  layout
                  onClick={() => router.push(`/events/${event.id}`)}
                  className="group flex items-center justify-between px-6 py-4 bg-surface border border-border hover:border-primary/40 hover:bg-surface/80 cursor-pointer transition-all"
                >
                  <div>
                    <h2 className="text-foreground font-medium group-hover:text-accent transition-colors">
                      {event.title}
                    </h2>
                    <p className="text-xs text-muted mt-1">
                      {event.quizzes?.length ?? 0} quiz
                      {(event.quizzes?.length ?? 0) !== 1 ? "zes" : ""} ·{" "}
                      {new Date(event.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={(e) => handleDelete(event.id, e)}
                      aria-label={`Delete event: ${event.title}`}
                      className="label text-muted/40 hover:text-danger transition-colors opacity-0 group-hover:opacity-100 focus-visible:outline-none focus-visible:opacity-100 focus-visible:text-danger focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      Delete
                    </button>
                    <span
                      aria-hidden
                      className="text-muted/40 group-hover:text-accent transition-colors select-none"
                    >
                      →
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
