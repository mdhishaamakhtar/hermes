"use client";

import { useEffect, useState, useActionState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import Navbar from "@/components/Navbar";

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

export default function QuizEditorPage() {
  const { id: eventId, qid } = useParams<{ id: string; qid: string }>();
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [qText, setQText] = useState("");
  const [qTime, setQTime] = useState(30);
  const [qOrder, setQOrder] = useState(1);
  const [options, setOptions] = useState<OptionReq[]>([
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ]);
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editText, setEditText] = useState("");
  const [editTime, setEditTime] = useState(30);
  const [editOptions, setEditOptions] = useState<OptionReq[]>([]);
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/auth/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) return;
    api.get<Quiz>(`/api/quizzes/${qid}`).then((res) => {
      if (res.success) {
        setQuiz(res.data);
        setQOrder((res.data.questions?.length ?? 0) + 1);
      }
    });
    api.get<SessionItem[]>(`/api/quizzes/${qid}/sessions`).then((res) => {
      if (res.success) setSessions(res.data);
    });
  }, [qid, user]);

  const setCorrect = (idx: number) =>
    setOptions((opts) => opts.map((o, i) => ({ ...o, isCorrect: i === idx })));

  const setEditCorrect = (idx: number) =>
    setEditOptions((opts) =>
      opts.map((o, i) => ({ ...o, isCorrect: i === idx })),
    );

  const addQuestionAction = async (_prev: null, formData: FormData) => {
    const text = formData.get("qText") as string;
    const time = Number(formData.get("qTime"));
    if (!options.some((o) => o.isCorrect)) {
      alert("Mark one option as correct");
      return null;
    }
    if (options.some((o) => !o.text.trim())) {
      alert("Fill all option texts");
      return null;
    }
    setCreating(true);
    const res = await api.post<Question>(`/api/quizzes/${qid}/questions`, {
      text,
      orderIndex: qOrder,
      timeLimitSeconds: time,
      options,
    });
    if (res.success) {
      setQuiz((prev) =>
        prev
          ? {
              ...prev,
              questions: [...(prev.questions || []), res.data].sort(
                (a, b) => a.orderIndex - b.orderIndex,
              ),
            }
          : prev,
      );
      setQText("");
      setQTime(30);
      setQOrder((quiz?.questions?.length ?? 0) + 2);
      setOptions([
        { text: "", isCorrect: true },
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
      ]);
      setShowForm(false);
    }
    setCreating(false);
    return null;
  };

  const [, addQuestionFormAction] = useActionState(addQuestionAction, null);

  const handleDeleteQuestion = async (qId: number) => {
    await api.delete(`/api/questions/${qId}`);
    setQuiz((prev) =>
      prev
        ? { ...prev, questions: prev.questions.filter((q) => q.id !== qId) }
        : prev,
    );
  };

  const openEdit = (q: Question) => {
    setEditingQuestion(q);
    setEditText(q.text);
    setEditTime(q.timeLimitSeconds);
    setEditOptions(
      q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
    );
    setShowForm(false);
  };

  const saveEditAction = async (_prev: null) => {
    if (!editingQuestion) return null;
    if (!editOptions.some((o) => o.isCorrect)) {
      alert("Mark one option as correct");
      return null;
    }
    if (editOptions.some((o) => !o.text.trim())) {
      alert("Fill all option texts");
      return null;
    }
    setSaving(true);
    const res = await api.put<Question>(
      `/api/questions/${editingQuestion.id}`,
      {
        text: editText,
        timeLimitSeconds: editTime,
        options: editOptions,
      },
    );
    if (res.success) {
      setQuiz((prev) =>
        prev
          ? {
              ...prev,
              questions: prev.questions.map((q) =>
                q.id === editingQuestion.id ? res.data : q,
              ),
            }
          : prev,
      );
      setEditingQuestion(null);
    }
    setSaving(false);
    return null;
  };

  const [, saveEditFormAction] = useActionState(saveEditAction, null);

  const handleLaunch = async () => {
    setLaunching(true);
    const res = await api.post<{ id: number; joinCode: string }>(
      "/api/sessions",
      { quizId: Number(qid) },
    );
    if (res.success) {
      localStorage.setItem(`hermes_session_${res.data.id}`, res.data.joinCode);
      router.push(`/session/${res.data.id}/host`);
    } else {
      alert(res.error?.message || "Failed to create session");
      setLaunching(false);
    }
  };

  if (isLoading || !user || !quiz) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-2">
          <Link
            href={`/events/${eventId}`}
            className="label hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            ← Event
          </Link>
        </div>

        <div className="flex items-start justify-between mb-10">
          <div>
            <p className="label mb-1">Quiz Editor</p>
            <h1 className="text-2xl font-bold text-foreground leading-tight">
              {quiz.title}
            </h1>
          </div>
          <button
            onClick={handleLaunch}
            disabled={launching || (quiz.questions?.length ?? 0) === 0}
            className="bg-primary text-white px-6 py-3 text-xs tracking-widest uppercase hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            style={{ boxShadow: "0 0 20px rgba(37,99,235,0.3)" }}
          >
            {launching ? "Launching..." : "↑ Launch Session"}
          </button>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="label">Questions ({quiz.questions?.length ?? 0})</h2>
          <button
            onClick={() => {
              setShowForm((v) => !v);
              setEditingQuestion(null);
            }}
            className="text-xs tracking-widest uppercase text-accent hover:text-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
              style={{ boxShadow: "0 0 20px rgba(37,99,235,0.1)" }}
            >
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="label block mb-2">Question Text</label>
                  <input
                    name="qText"
                    value={qText}
                    onChange={(e) => setQText(e.target.value)}
                    required
                    className="input-field"
                    placeholder="What is..."
                  />
                </div>
                <div className="w-28">
                  <label className="label block mb-2">Time (s)</label>
                  <input
                    type="number"
                    name="qTime"
                    value={qTime}
                    onChange={(e) => setQTime(Number(e.target.value))}
                    min={5}
                    className="input-field font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="label block mb-3">
                  Options{" "}
                  <span className="normal-case text-muted/50">
                    (click to mark correct)
                  </span>
                </label>
                <div className="space-y-2">
                  {options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setCorrect(i)}
                        className={`w-4 h-4 border shrink-0 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success ${opt.isCorrect ? "bg-success border-success" : "border-border hover:border-success/50"}`}
                        aria-label={`Mark option ${i + 1} as correct`}
                      />
                      <input
                        value={opt.text}
                        onChange={(e) =>
                          setOptions((opts) =>
                            opts.map((o, j) =>
                              j === i ? { ...o, text: e.target.value } : o,
                            ),
                          )
                        }
                        placeholder={`Option ${i + 1}`}
                        className="input-field"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                disabled={creating}
                className="bg-primary text-white px-5 py-2 text-xs tracking-widest uppercase hover:bg-primary-hover disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {creating ? "Adding..." : "Add Question"}
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="h-px bg-border mb-4" />

        {(quiz.questions?.length ?? 0) === 0 ? (
          <p className="text-center py-16 text-muted text-sm">
            No questions yet. Add one above.
          </p>
        ) : (
          <div className="space-y-2 mb-12">
            {quiz.questions
              ?.sort((a, b) => a.orderIndex - b.orderIndex)
              .map((q) => (
                <div key={q.id}>
                  {/* View row */}
                  {editingQuestion?.id !== q.id && (
                    <div className="border border-border bg-surface p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3">
                          <span className="font-mono text-xs text-muted mt-0.5 tabular-nums">
                            {q.orderIndex}.
                          </span>
                          <div>
                            <p className="text-foreground text-sm font-medium">
                              {q.text}
                            </p>
                            <p className="text-xs text-muted mt-0.5">
                              {q.timeLimitSeconds}s
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => openEdit(q)}
                            className="label text-muted/40 hover:text-accent transition-colors focus-visible:outline-none focus-visible:opacity-100"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="label text-muted/40 hover:text-danger transition-colors focus-visible:outline-none focus-visible:opacity-100"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 ml-6">
                        {q.options?.map((opt) => (
                          <div
                            key={opt.id}
                            className={`px-3 py-1.5 text-xs border ${opt.isCorrect ? "border-success/40 text-success bg-success/5" : "border-border text-muted"}`}
                          >
                            {opt.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inline edit form */}
                  <AnimatePresence>
                    {editingQuestion?.id === q.id && (
                      <motion.form
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        action={saveEditFormAction}
                        className="border border-warning/40 bg-surface p-6 space-y-4"
                        style={{ boxShadow: "0 0 20px rgba(217,119,6,0.08)" }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs tracking-widest uppercase text-warning">
                            Editing Q{q.orderIndex}
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
                            <label className="label block mb-2">
                              Question Text
                            </label>
                            <input
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              required
                              className="input-field"
                            />
                          </div>
                          <div className="w-28">
                            <label className="label block mb-2">Time (s)</label>
                            <input
                              type="number"
                              value={editTime}
                              onChange={(e) =>
                                setEditTime(Number(e.target.value))
                              }
                              min={5}
                              className="input-field font-mono"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="label block mb-3">
                            Options{" "}
                            <span className="normal-case text-muted/50">
                              (click to mark correct)
                            </span>
                          </label>
                          <div className="space-y-2">
                            {editOptions.map((opt, i) => (
                              <div key={i} className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => setEditCorrect(i)}
                                  className={`w-4 h-4 border shrink-0 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success ${opt.isCorrect ? "bg-success border-success" : "border-border hover:border-success/50"}`}
                                  aria-label={`Mark option ${i + 1} as correct`}
                                />
                                <input
                                  value={opt.text}
                                  onChange={(e) =>
                                    setEditOptions((opts) =>
                                      opts.map((o, j) =>
                                        j === i
                                          ? { ...o, text: e.target.value }
                                          : o,
                                      ),
                                    )
                                  }
                                  placeholder={`Option ${i + 1}`}
                                  className="input-field"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                        <button
                          type="submit"
                          disabled={saving}
                          className="bg-warning text-white px-5 py-2 text-xs tracking-widest uppercase hover:bg-warning-hover disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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

        {sessions.length > 0 && (
          <>
            <div className="h-px bg-border mb-6" />
            <h2 className="label mb-4">Past Sessions</h2>
            <div className="space-y-px">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-5 py-3 bg-surface border border-border"
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`text-xs tracking-widest uppercase px-2 py-0.5 ${s.status === "ENDED" ? "text-muted bg-border" : "text-success bg-success/10"}`}
                    >
                      {s.status}
                    </span>
                    <span className="text-xs text-muted tabular-nums">
                      {s.participantCount} participants
                    </span>
                    {s.startedAt && (
                      <span className="text-xs text-muted/50">
                        {new Date(s.startedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {s.status === "ENDED" && (
                    <button
                      onClick={() => router.push(`/session/${s.id}/review`)}
                      className="label text-accent hover:text-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      Review →
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
