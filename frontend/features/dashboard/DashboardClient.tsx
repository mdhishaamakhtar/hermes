"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import useSWR from "swr";
import { LoadError } from "@/components/LoadError";
import { Page, PageHeader, PageHeaderSkeleton } from "@/components/Page";
import { ResourceRow, ResourceRowSkeleton } from "@/components/ResourceRow";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { eventsApi } from "@/features/events/events-api";
import { quizApi } from "@/features/quizzes/quiz-api";
import { describeError } from "@/lib/api";
import { countLabel, formatDate } from "@/lib/format";
import { rise } from "@/lib/motion";
import type { EventSummary, QuizListItem } from "@/lib/types";

type DeleteTarget =
  { kind: "quiz"; item: QuizListItem } | { kind: "event"; item: EventSummary };

const editorHref = (quiz: { id: number; eventId: number }) =>
  `/events/${quiz.eventId}/quizzes/${quiz.id}`;

/**
 * The organiser's home: their quizzes first, since a quiz is what they run.
 * Events are optional, a way to group quizzes run together, and sit below.
 */
export function DashboardClient() {
  const router = useRouter();
  const quizzesQuery = useSWR<QuizListItem[]>("/api/quizzes");
  const eventsQuery = useSWR<EventSummary[]>("/api/events");
  const [composing, setComposing] = useState<"quiz" | "event" | null>(null);
  const [sampling, setSampling] = useState(false);
  // Kept apart from `confirmOpen` so the dialog's title does not blank out
  // while it animates closed.
  const [target, setTarget] = useState<DeleteTarget | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const quizzes = quizzesQuery.data;
  const events = eventsQuery.data;
  const error = quizzesQuery.error ?? eventsQuery.error;

  if (!quizzes || !events) {
    return error ? (
      <Page>
        <LoadError
          error={error}
          resource="quiz list"
          back={{ href: "/", label: "Back to Hermes" }}
          onRetry={() => {
            void quizzesQuery.mutate();
            void eventsQuery.mutate();
          }}
        />
      </Page>
    ) : (
      <DashboardSkeleton />
    );
  }

  const refresh = () => {
    void quizzesQuery.mutate();
    void eventsQuery.mutate();
  };

  const openSample = async () => {
    setSampling(true);
    try {
      const sample = await quizApi.createSample();
      refresh();
      router.push(editorHref(sample));
    } catch (err) {
      toast.error(describeError(err, "Couldn't add the sample quiz."));
      setSampling(false);
    }
  };

  const duplicate = async (quiz: QuizListItem) => {
    try {
      const copy = await quizApi.duplicate(quiz.id);
      toast.success(`Added "${copy.title}"`);
      refresh();
    } catch (err) {
      toast.error(describeError(err, "Couldn't duplicate the quiz."));
    }
  };

  const deleteTarget = async () => {
    if (!target) return;
    if (target.kind === "quiz") {
      await quizApi.delete(target.item.id);
    } else {
      await eventsApi.delete(target.item.id);
    }
    refresh();
    toast.success(`Deleted "${target.item.title}"`);
  };

  return (
    <Page>
      <PageHeader
        title="Quizzes"
        actions={
          composing !== "quiz" &&
          quizzes.length > 0 && (
            <Button
              variant="primary"
              icon="plus"
              onClick={() => setComposing("quiz")}
            >
              New quiz
            </Button>
          )
        }
      />

      <AnimatePresence initial={false}>
        {composing === "quiz" && (
          <NewQuizForm
            key="new-quiz"
            onCancel={() => setComposing(null)}
            onCreated={(quiz) => {
              refresh();
              router.push(editorHref(quiz));
            }}
          />
        )}
      </AnimatePresence>

      {quizzes.length === 0 ? (
        composing !== "quiz" && (
          <EmptyState
            title="Write your first quiz"
            description="A quiz is a set of questions you host live. Start from scratch, or open the sample to see how one runs."
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  variant="primary"
                  icon="plus"
                  onClick={() => setComposing("quiz")}
                >
                  New quiz
                </Button>
                <Button icon="sparkle" pending={sampling} onClick={openSample}>
                  {sampling ? "Adding…" : "Try the sample quiz"}
                </Button>
              </div>
            }
          />
        )
      ) : (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {quizzes.map((quiz) => (
              <ResourceRow
                key={quiz.id}
                href={editorHref(quiz)}
                title={quiz.title}
                subtitle={[
                  countLabel(quiz.questionCount, "question", "questions"),
                  quiz.defaultEvent ? null : quiz.eventTitle,
                  formatDate(quiz.createdAt),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                duplicateLabel={`Duplicate quiz: ${quiz.title}`}
                onDuplicate={() => void duplicate(quiz)}
                deleteLabel={`Delete quiz: ${quiz.title}`}
                onDelete={() => {
                  setTarget({ kind: "quiz", item: quiz });
                  setConfirmOpen(true);
                }}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}

      <section aria-labelledby="events-heading" className="mt-16">
        <div className="flex items-baseline justify-between gap-4">
          <h2
            id="events-heading"
            className="text-xl font-semibold text-foreground"
          >
            Events
          </h2>
          {composing !== "event" && (
            <Button
              variant="ghost"
              size="sm"
              icon="plus"
              className="ghost-flush-end"
              onClick={() => setComposing("event")}
            >
              New event
            </Button>
          )}
        </div>
        <p className="mt-1 mb-5 max-w-xl text-sm text-muted">
          Optional. Group the quizzes you run together, like the rounds of one
          trivia night.
        </p>

        <AnimatePresence initial={false}>
          {composing === "event" && (
            <NewEventForm
              key="new-event"
              onCancel={() => setComposing(null)}
              onCreated={(created) => router.push(`/events/${created.id}`)}
            />
          )}
        </AnimatePresence>

        {events.length > 0 && (
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
                    setTarget({ kind: "event", item: event });
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
        title={`Delete "${target?.item.title ?? ""}"?`}
        description={
          target?.kind === "event"
            ? "Its quizzes, questions, and every session's results will be permanently removed. This can't be undone."
            : "Its questions and every session's results will be permanently removed. This can't be undone."
        }
        confirmLabel={target?.kind === "event" ? "Delete event" : "Delete quiz"}
        onConfirm={deleteTarget}
      />
    </Page>
  );
}

function NewQuizForm({
  onCreated,
  onCancel,
}: {
  onCreated: (quiz: { id: number; eventId: number }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");

  const [error, submit, pending] = useActionState<string | null>(async () => {
    const trimmed = title.trim();
    if (!trimmed) return "Give the quiz a title.";
    try {
      onCreated(await quizApi.create(trimmed));
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
      className="mb-8 border border-border bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <TextField
          label="Quiz title"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={255}
          placeholder="Friday trivia: round one"
          error={error}
          fieldClassName="flex-1"
          autoFocus
        />
        <div className="flex gap-3 sm:pt-7">
          <Button type="submit" variant="primary" pending={pending}>
            {pending ? "Creating…" : "Create quiz"}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </motion.form>
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
      className="mb-6 border border-border bg-surface p-5 sm:p-6"
      aria-labelledby="new-event-heading"
    >
      <h3
        id="new-event-heading"
        className="mb-5 text-lg font-semibold text-foreground"
      >
        New event
      </h3>
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
      <LoadingRegion label="Loading your quizzes">
        <PageHeaderSkeleton titleWidth="w-40" action />
        <ul className="flex flex-col gap-2">
          {[0, 1, 2].map((row) => (
            <ResourceRowSkeleton key={row} />
          ))}
        </ul>
        <Skeleton className="mt-16 h-7 w-24" />
      </LoadingRegion>
    </Page>
  );
}
