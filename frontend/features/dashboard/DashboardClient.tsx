"use client";

import { useActionState, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import useSWR from "swr";
import { LoadError } from "@/components/LoadError";
import { Page, PageHeader, PageHeaderSkeleton } from "@/components/Page";
import { ResourceRow, ResourceRowSkeleton } from "@/components/ResourceRow";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { LoadingRegion } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { eventsApi } from "@/features/events/events-api";
import { describeError } from "@/lib/api";
import { countLabel, formatDate } from "@/lib/format";
import { rise } from "@/lib/motion";
import type { EventSummary } from "@/lib/types";

export function DashboardClient() {
  const { data: events, error, mutate } = useSWR<EventSummary[]>("/api/events");
  const [composing, setComposing] = useState(false);
  // Kept separately from `confirmOpen` so the dialog's title does not blank
  // out while it animates closed.
  const [target, setTarget] = useState<EventSummary | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!events) {
    return error ? (
      <Page>
        <LoadError
          error={error}
          resource="event list"
          back={{ href: "/", label: "Back to Hermes" }}
          onRetry={() => void mutate()}
        />
      </Page>
    ) : (
      <DashboardSkeleton />
    );
  }

  const deleteTarget = async () => {
    if (!target) return;
    await eventsApi.delete(target.id);
    await mutate(
      events.filter((event) => event.id !== target.id),
      { revalidate: false },
    );
    toast.success(`Deleted "${target.title}"`);
  };

  return (
    <Page>
      <PageHeader
        title="Events"
        actions={
          !composing &&
          events.length > 0 && (
            <Button
              variant="primary"
              icon="plus"
              onClick={() => setComposing(true)}
            >
              New event
            </Button>
          )
        }
      />

      <AnimatePresence initial={false}>
        {composing && (
          <NewEventForm
            key="new-event"
            onCancel={() => setComposing(false)}
            onCreated={(created) => {
              void mutate([created, ...events], { revalidate: false });
              setComposing(false);
            }}
          />
        )}
      </AnimatePresence>

      {events.length === 0 ? (
        !composing && (
          <EmptyState
            title="No events yet"
            description="An event holds the quizzes you run together: a class, a meetup, a trivia night."
            action={
              <Button
                variant="primary"
                icon="plus"
                onClick={() => setComposing(true)}
              >
                Create your first event
              </Button>
            }
          />
        )
      ) : (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {events.map((event) => (
              <ResourceRow
                key={event.id}
                href={`/events/${event.id}`}
                title={event.title}
                subtitle={[
                  countLabel(event.quizzes.length, "quiz", "quizzes"),
                  formatDate(event.createdAt),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                deleteLabel={`Delete event: ${event.title}`}
                onDelete={() => {
                  setTarget(event);
                  setConfirmOpen(true);
                }}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`Delete "${target?.title ?? ""}"?`}
        description="Its quizzes, questions, and every session's results will be permanently removed. This can't be undone."
        confirmLabel="Delete event"
        onConfirm={deleteTarget}
      />
    </Page>
  );
}

function NewEventForm({
  onCreated,
  onCancel,
}: {
  onCreated: (event: EventSummary) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [error, submit, pending] = useActionState<string | null>(async () => {
    const trimmed = title.trim();
    if (!trimmed) return "Give the event a title.";
    try {
      onCreated(
        await eventsApi.create({
          title: trimmed,
          description: description.trim(),
        }),
      );
      return null;
    } catch (err) {
      return describeError(err, "Couldn't create the event.");
    }
  }, null);

  return (
    <motion.form
      {...rise}
      action={submit}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
      className="mb-8 border border-border bg-surface p-5 sm:p-6"
      aria-labelledby="new-event-heading"
    >
      <h2
        id="new-event-heading"
        className="mb-5 text-lg font-semibold text-foreground"
      >
        New event
      </h2>
      <div className="flex flex-col gap-5">
        <TextField
          label="Title"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={255}
          placeholder="Friday trivia night"
          error={error}
          autoFocus
        />
        <TextAreaField
          label="Description"
          hint="Optional. Only you see it."
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
        />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="submit" variant="primary" pending={pending}>
          {pending ? "Creating…" : "Create event"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </motion.form>
  );
}

export function DashboardSkeleton() {
  return (
    <Page>
      <LoadingRegion label="Loading your events">
        <PageHeaderSkeleton titleWidth="w-32" action />
        <ul className="flex flex-col gap-2">
          {[0, 1, 2].map((row) => (
            <ResourceRowSkeleton key={row} />
          ))}
        </ul>
      </LoadingRegion>
    </Page>
  );
}
