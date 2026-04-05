"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { api } from "@/lib/api";

interface OptionReq {
  text: string;
  isCorrect: boolean;
}

interface Option {
  id: number;
  text: string;
  orderIndex: number;
  isCorrect: boolean;
}

interface Question {
  id: number;
  text: string;
  orderIndex: number;
  timeLimitSeconds: number;
  options: Option[];
}

interface Quiz {
  id: number;
  title: string;
  orderIndex: number;
  questions: Question[];
}

interface SessionItem {
  id: number;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  participantCount: number;
}

const EMPTY_OPTIONS: OptionReq[] = [
  { text: "", isCorrect: true },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
];

export default function QuizEditorClient({
  eventId,
  quizId,
  initialQuiz,
  initialSessions,
}: {
  eventId: string;
  quizId: string;
  initialQuiz: Quiz;
  initialSessions: SessionItem[];
}) {
  const router = useRouter();
  const [quiz, setQuiz] = useState(initialQuiz);
  const [sessions, setSessions] = useState(initialSessions);
  const [showForm, setShowForm] = useState(false);
  const [qText, setQText] = useState("");
  const [qTime, setQTime] = useState(30);
  const [qOrder, setQOrder] = useState((initialQuiz.questions.length ?? 0) + 1);
  const [options, setOptions] = useState<OptionReq[]>(EMPTY_OPTIONS);
  const [creating, setCreating] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editText, setEditText] = useState("");
  const [editTime, setEditTime] = useState(30);
  const [editOptions, setEditOptions] = useState<OptionReq[]>([]);
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const questions = useMemo(
    () => quiz.questions.toSorted((a, b) => a.orderIndex - b.orderIndex),
    [quiz.questions],
  );

  const hasBlockingSession = sessions.some(
    (s) => s.status === "LOBBY" || s.status === "ACTIVE",
  );

  const setCorrect = (idx: number) =>
    setOptions((current) =>
      current.map((option, index) => ({ ...option, isCorrect: index === idx })),
    );

  const setEditCorrect = (idx: number) =>
    setEditOptions((current) =>
      current.map((option, index) => ({ ...option, isCorrect: index === idx })),
    );

  const addQuestionAction = async (_prev: null, formData: FormData) => {
    const text = formData.get("qText") as string;
    const time = Number(formData.get("qTime"));

    if (!options.some((option) => option.isCorrect)) {
      alert("Mark one option as correct");
      return null;
    }
    if (options.some((option) => !option.text.trim())) {
      alert("Fill all option texts");
      return null;
    }

    setCreating(true);
    const res = await api.post<Question>(`/api/quizzes/${quizId}/questions`, {
      text,
      orderIndex: qOrder,
      timeLimitSeconds: time,
      options,
    });

    if (res.success) {
      setQuiz((prev) => ({
        ...prev,
        questions: [...prev.questions, res.data].toSorted(
          (a, b) => a.orderIndex - b.orderIndex,
        ),
      }));
      setQText("");
      setQTime(30);
      setQOrder((questions.length ?? 0) + 2);
      setOptions(EMPTY_OPTIONS);
      setShowForm(false);
    }

    setCreating(false);
    return null;
  };

  const [, addQuestionFormAction] = useActionState(addQuestionAction, null);

  const handleDeleteQuestion = async (questionId: number) => {
    const res = await api.delete(`/api/questions/${questionId}`);
    if (res.success) {
      setQuiz((prev) => ({
        ...prev,
        questions: prev.questions.filter(
          (question) => question.id !== questionId,
        ),
      }));
    }
  };

  const openEdit = (question: Question) => {
    setEditingQuestion(question);
    setEditText(question.text);
    setEditTime(question.timeLimitSeconds);
    setEditOptions(
      question.options.map((option) => ({
        text: option.text,
        isCorrect: option.isCorrect,
      })),
    );
    setShowForm(false);
  };

  const saveEditAction = async () => {
    if (!editingQuestion) return null;
    if (!editOptions.some((option) => option.isCorrect)) {
      alert("Mark one option as correct");
      return null;
    }
    if (editOptions.some((option) => !option.text.trim())) {
      alert("Fill all option texts");
      return null;
    }

    setSaving(true);
    const res = await api.put<Question>(
      `/api/questions/${editingQuestion.id}`,
      {
        text: editText,
        orderIndex: editingQuestion.orderIndex,
        timeLimitSeconds: editTime,
        options: editOptions,
      },
    );

    if (res.success) {
      setQuiz((prev) => ({
        ...prev,
        questions: prev.questions.map((question) =>
          question.id === editingQuestion.id ? res.data : question,
        ),
      }));
      setEditingQuestion(null);
    }

    setSaving(false);
    return null;
  };

  const [, saveEditFormAction] = useActionState(saveEditAction, null);

  const handleAbandon = (sessionId: number) => {
    setConfirmDialog({
      message: "Abandon this session? The quiz will become editable again.",
      onConfirm: async () => {
        setConfirmDialog(null);
        setAbandoning(true);
        const res = await api.post(`/api/sessions/${sessionId}/end`);
        if (res.success) {
          setSessions((prev) =>
            prev.map((session) =>
              session.id === sessionId
                ? { ...session, status: "ENDED" }
                : session,
            ),
          );
        }
        setAbandoning(false);
      },
    });
  };

  const handleAbandonAll = () => {
    const lobbyIds = sessions
      .filter((session) => session.status === "LOBBY")
      .map((session) => session.id);

    if (!lobbyIds.length) return;

    setConfirmDialog({
      message: `Abandon all ${lobbyIds.length} lobby session(s)? The quiz will become editable again.`,
      onConfirm: async () => {
        setConfirmDialog(null);
        setAbandoning(true);
        await Promise.all(
          lobbyIds.map((id) => api.post(`/api/sessions/${id}/end`)),
        );
        setSessions((prev) =>
          prev.map((session) =>
            lobbyIds.includes(session.id)
              ? { ...session, status: "ENDED" }
              : session,
          ),
        );
        setAbandoning(false);
      },
    });
  };

  const handleLaunch = async () => {
    setLaunching(true);
    const res = await api.post<{ id: number; joinCode: string }>(
      "/api/sessions",
      {
        quizId: Number(quizId),
      },
    );

    if (res.success) {
      localStorage.setItem(`hermes_session_${res.data.id}`, res.data.joinCode);
      router.refresh();
      router.push(`/session/${res.data.id}/host`);
      return;
    }

    alert(res.error?.message || "Failed to create session");
    setLaunching(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-2">
        <Link
          href={`/events/${eventId}`}
          prefetch
          className="label hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          ← Event
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-start justify-between mb-10"
      >
        <div>
          <p className="label mb-1">Quiz Editor</p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
            {quiz.title}
          </h1>
        </div>
        <button
          onClick={handleLaunch}
          disabled={launching || questions.length === 0}
          className="bg-primary text-white px-6 py-3 text-sm tracking-widest uppercase hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {launching ? "Launching..." : "↑ Launch Session"}
        </button>
      </motion.div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="label">Questions ({questions.length})</h2>
        <button
          onClick={() => {
            setShowForm((value) => !value);
            setEditingQuestion(null);
          }}
          disabled={hasBlockingSession}
          className="text-sm tracking-widest uppercase text-accent hover:text-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {showForm ? "Cancel" : "+ Add Question"}
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            action={addQuestionFormAction}
            className="mb-6 border border-primary/40 bg-surface p-6 space-y-4"
          >
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="field-label block mb-2">Question Text</label>
                <input
                  name="qText"
                  value={qText}
                  onChange={(eventObj) => setQText(eventObj.target.value)}
                  required
                  className="input-field"
                  placeholder="What is..."
                />
              </div>
              <div className="w-28">
                <label className="field-label block mb-2">Time (s)</label>
                <input
                  type="number"
                  name="qTime"
                  value={qTime}
                  onChange={(eventObj) =>
                    setQTime(Number(eventObj.target.value))
                  }
                  min={5}
                  className="input-field font-mono"
                />
              </div>
            </div>
            <div>
              <label className="field-label block mb-3">
                Options{" "}
                <span className="text-muted/50">(click to mark correct)</span>
              </label>
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCorrect(index)}
                      className={`w-4 h-4 border shrink-0 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success ${option.isCorrect ? "bg-success border-success" : "border-border hover:border-success/50"}`}
                      aria-label={`Mark option ${index + 1} as correct`}
                    />
                    <input
                      value={option.text}
                      onChange={(eventObj) =>
                        setOptions((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, text: eventObj.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder={`Option ${index + 1}`}
                      className="input-field"
                    />
                  </div>
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={creating}
              className="bg-primary text-white px-5 py-2 text-sm tracking-widest uppercase hover:bg-primary-hover disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {creating ? "Adding..." : "Add Question"}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="h-px bg-border mb-4" />

      {questions.length === 0 ? (
        <p className="text-center py-16 text-muted text-sm">
          No questions yet. Add one above.
        </p>
      ) : (
        <div className="space-y-2 mb-12">
          {questions.map((question, index) => (
            <div key={question.id}>
              <AnimatePresence mode="wait" initial>
                {editingQuestion?.id !== question.id ? (
                  <motion.div
                    key="view"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.1 } }}
                    transition={{ duration: 0.15, delay: index * 0.04 }}
                    className="border border-border bg-surface p-6"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3">
                        <span className="font-mono text-xs text-muted mt-0.5 tabular-nums">
                          {question.orderIndex}.
                        </span>
                        <div>
                          <p className="text-foreground text-base font-medium">
                            {question.text}
                          </p>
                          <p className="text-xs text-muted mt-0.5">
                            {question.timeLimitSeconds}s
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => openEdit(question)}
                          disabled={hasBlockingSession}
                          className="label text-muted/40 hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:opacity-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(question.id)}
                          disabled={hasBlockingSession}
                          className="label text-muted/40 hover:text-danger disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:opacity-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 ml-6">
                      {question.options.map((option) => (
                        <div
                          key={option.id}
                          className={`px-3 py-1.5 text-xs border ${option.isCorrect ? "border-success/40 text-success bg-success/5" : "border-border text-muted"}`}
                        >
                          {option.text}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.form
                    key="edit"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
                    action={saveEditFormAction}
                    className="border border-warning/40 bg-surface p-6 space-y-4"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs tracking-widest uppercase text-warning">
                        Editing Q{question.orderIndex}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingQuestion(null)}
                        className="label hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="field-label block mb-2">
                          Question Text
                        </label>
                        <input
                          value={editText}
                          onChange={(eventObj) =>
                            setEditText(eventObj.target.value)
                          }
                          required
                          className="input-field"
                        />
                      </div>
                      <div className="w-28">
                        <label className="field-label block mb-2">
                          Time (s)
                        </label>
                        <input
                          type="number"
                          value={editTime}
                          onChange={(eventObj) =>
                            setEditTime(Number(eventObj.target.value))
                          }
                          min={5}
                          className="input-field font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="field-label block mb-3">
                        Options{" "}
                        <span className="text-muted/50">
                          (click to mark correct)
                        </span>
                      </label>
                      <div className="space-y-2">
                        {editOptions.map((option, index) => (
                          <div key={index} className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setEditCorrect(index)}
                              className={`w-4 h-4 border shrink-0 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success ${option.isCorrect ? "bg-success border-success" : "border-border hover:border-success/50"}`}
                              aria-label={`Mark option ${index + 1} as correct`}
                            />
                            <input
                              value={option.text}
                              onChange={(eventObj) =>
                                setEditOptions((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, text: eventObj.target.value }
                                      : item,
                                  ),
                                )
                              }
                              placeholder={`Option ${index + 1}`}
                              className="input-field"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={saving}
                      className="bg-warning text-white px-5 py-2 text-sm tracking-widest uppercase hover:bg-warning-hover disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {confirmDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
              className="bg-surface border border-warning/40 p-8 max-w-md w-full mx-6 space-y-6"
            >
              <p className="text-sm text-foreground leading-relaxed">
                {confirmDialog.message}
              </p>
              <div className="flex items-center justify-end gap-4">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="label text-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className="bg-warning text-white px-5 py-2 text-sm tracking-widest uppercase hover:bg-warning-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Abandon
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {sessions.length > 0 && (
        <>
          <div className="h-px bg-border mb-6" />
          <div className="flex items-center justify-between mb-4">
            <h2 className="label">Past Sessions</h2>
            {sessions.some((session) => session.status === "LOBBY") && (
              <button
                onClick={handleAbandonAll}
                disabled={abandoning}
                className="text-sm tracking-widest uppercase text-warning hover:text-warning/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning"
              >
                {abandoning ? "Abandoning..." : "Abandon All →"}
              </button>
            )}
          </div>
          <div className="space-y-px">
            {sessions.map((session, index) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, delay: index * 0.04 }}
                className="flex items-center justify-between px-6 py-4 bg-surface border border-border"
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`text-xs tracking-widest uppercase px-2 py-0.5 ${
                      session.status === "ENDED"
                        ? "text-muted bg-border"
                        : session.status === "LOBBY"
                          ? "text-warning bg-warning/10"
                          : "text-success bg-success/10"
                    }`}
                  >
                    {session.status}
                  </span>
                  <span className="text-xs text-muted tabular-nums">
                    {session.participantCount} participants
                  </span>
                  {session.startedAt && (
                    <span className="text-xs text-muted/50">
                      {new Date(session.startedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {session.status === "ENDED" && (
                  <Link
                    href={`/session/${session.id}/review`}
                    prefetch
                    className="label text-accent hover:text-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Review →
                  </Link>
                )}

                {session.status === "LOBBY" && (
                  <button
                    onClick={() => handleAbandon(session.id)}
                    disabled={abandoning}
                    className="label text-warning hover:text-warning/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning"
                  >
                    {abandoning ? "Abandoning..." : "Abandon →"}
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
