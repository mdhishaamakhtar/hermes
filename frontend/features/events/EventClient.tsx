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
import { TextField } from "@/components/ui/Field";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { eventsApi } from "@/features/events/events-api";
import { describeError } from "@/lib/api";
import { rise } from "@/lib/motion";
import { byOrderIndex } from "@/lib/options";
import type { EventSummary, QuizSummary } from "@/lib/types";

const CRUMBS = [{ href: "/dashboard", label: "Events" }];

export function EventClient({ eventId }: { eventId: string }) {
  const {
    data: event,
    error,
    mutate,
  } = useSWR<EventSummary>(`/api/events/${eventId}`);
  const [composing, setComposing] = useState(false);
  const [target, setTarget] = useState<QuizSummary | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!event) {
    return error ? (
      <Page>
        <LoadError
          error={error}
          resource="event"
          back={{ href: "/dashboard", label: "All events" }}
          onRetry={() => void mutate()}
        />
      </Page>
    ) : (
      <EventSkeleton />
    );
  }

  const quizzes = byOrderIndex(event.quizzes);
  const nextOrderIndex =
    quizzes.reduce((max, quiz) => Math.max(max, quiz.orderIndex), 0) + 1;

  const deleteTarget = async () => {
    if (!target) return;
    await eventsApi.deleteQuiz(target.id);
    await mutate(
      {
        ...event,
        quizzes: event.quizzes.filter((quiz) => quiz.id !== target.id),
      },
      { revalidate: false },
    );
    toast.success(`Deleted "${target.title}"`);
  };

  const newQuizButton = (label: string) => (
    <Button variant="primary" icon="plus" onClick={() => setComposing(true)}>
      {label}
    </Button>
  );

  return (
    <Page>
      <PageHeader
        crumbs={CRUMBS}
        title={event.title}
        description={event.description || undefined}
      />

      <section aria-labelledby="quizzes-heading">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2
            id="quizzes-heading"
            className="text-xl font-semibold text-foreground"
          >
            Quizzes
          </h2>
          {!composing && quizzes.length > 0 && newQuizButton("New quiz")}
        </div>

        <AnimatePresence initial={false}>
          {composing && (
            <NewQuizForm
              key="new-quiz"
              eventId={eventId}
              orderIndex={nextOrderIndex}
              onCancel={() => setComposing(false)}
              onCreated={(created) => {
                void mutate(
                  { ...event, quizzes: [...event.quizzes, created] },
                  { revalidate: false },
                );
                setComposing(false);
              }}
            />
          )}
        </AnimatePresence>

        {quizzes.length === 0 ? (
          !composing && (
            <EmptyState
              title="No quizzes in this event yet"
              description="A quiz is a set of questions you host live. Add one to start writing questions."
              action={newQuizButton("Add a quiz")}
            />
          )
        ) : (
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {quizzes.map((quiz, index) => (
                <ResourceRow
                  key={quiz.id}
                  href={`/events/${eventId}/quizzes/${quiz.id}`}
                  title={quiz.title}
                  leading={
                    <span className="block w-6 font-mono text-sm text-subtle tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  }
                  deleteLabel={`Delete quiz: ${quiz.title}`}
                  onDelete={() => {
                    setTarget(quiz);
                    setConfirmOpen(true);
                  }}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`Delete "${target?.title ?? ""}"?`}
        description="Its questions and every session's results will be permanently removed. This can't be undone."
        confirmLabel="Delete quiz"
        onConfirm={deleteTarget}
      />
    </Page>
  );
}

function NewQuizForm({
  eventId,
  orderIndex,
  onCreated,
  onCancel,
}: {
  eventId: string;
  orderIndex: number;
  onCreated: (quiz: QuizSummary) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");

  const [error, submit, pending] = useActionState<string | null>(async () => {
    const trimmed = title.trim();
    if (!trimmed) return "Give the quiz a title.";
    try {
      onCreated(
        await eventsApi.createQuiz(eventId, { title: trimmed, orderIndex }),
      );
      return null;
    } catch (err) {
      return describeError(err, "Couldn't create the quiz.");
    }
  }, null);

  return (
    <motion.form
      {...rise}
      action={submit}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
      className="mb-6 border border-border bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <TextField
          label="Quiz title"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={255}
          placeholder="Round one: general knowledge"
          error={error}
          fieldClassName="flex-1"
          autoFocus
        />
        <div className="flex gap-3 sm:pt-7">
          <Button type="submit" variant="primary" pending={pending}>
            {pending ? "Adding…" : "Add quiz"}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </motion.form>
  );
}

export function EventSkeleton() {
  return (
    <Page>
      <LoadingRegion label="Loading event">
        <PageHeaderSkeleton crumbs description titleWidth="w-64" />
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-11 w-32" />
        </div>
        <ul className="flex flex-col gap-2">
          {[0, 1, 2].map((row) => (
            <ResourceRowSkeleton key={row} subtitle={false} leading />
          ))}
        </ul>
      </LoadingRegion>
    </Page>
  );
}
