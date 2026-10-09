"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, TextField } from "@/components/ui/Field";
import { sessionsApi } from "@/features/session/session-api";
import { describeError, errorStatus } from "@/lib/api";
import { rise } from "@/lib/motion";
import {
  getStoredRejoinToken,
  listJoinedSessions,
  storePlayer,
} from "@/lib/session-storage";
import { CODE_LENGTH, CodeInput, normalizeCode } from "./CodeInput";

const NAME_MAX = 30;

type JoinErrors = Partial<Record<"code" | "name" | "form", string>>;

/** A session this device already joined that is still running, if any. */
function useRunningSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const [latest] = listJoinedSessions();
    if (!latest) return;
    sessionsApi
      .rejoin(latest.sessionId, latest.token)
      .then((response) => {
        if (!cancelled && response.status !== "ENDED") {
          setSessionId(latest.sessionId);
        }
      })
      // An expired or unknown token simply means there is nothing to resume.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return sessionId;
}

export function JoinForm({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const codeId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState(() => normalizeCode(initialCode));
  const [name, setName] = useState("");
  const runningSession = useRunningSession();

  const [errors, submit, pending] = useActionState<JoinErrors>(async () => {
    const invalid: JoinErrors = {};
    if (code.length !== CODE_LENGTH) {
      invalid.code = "Enter all six characters of the code.";
    }
    if (!name.trim()) invalid.name = "Add the name other players will see.";
    if (Object.keys(invalid).length > 0) return invalid;

    try {
      const joined = await sessionsApi.join(code, name.trim());
      // A token already on this device is an existing player in this
      // session; keep it, or their earlier answers would be orphaned.
      if (!getStoredRejoinToken(joined.sessionId)) {
        storePlayer(joined.sessionId, joined.rejoinToken, name.trim());
      }
      router.push(`/session/${joined.sessionId}/play`);
      return {};
    } catch (err) {
      const status = errorStatus(err);
      if (status === 404) {
        return {
          code: "No live session uses that code. Check it with your host.",
        };
      }
      if (status === 409) {
        return { code: "That session has already finished." };
      }
      return { form: describeError(err, "Couldn't join that session.") };
    }
  }, {});

  return (
    <>
      <AnimatePresence>
        {runningSession && (
          <motion.div
            {...rise}
            className="mb-10 flex flex-wrap items-center justify-between gap-4 border border-accent/30 bg-accent/5 px-4 py-3.5"
          >
            <div className="flex items-center gap-3">
              <Badge tone="live" dot>
                Live
              </Badge>
              <p className="text-sm text-foreground">
                You&apos;re still in a session.
              </p>
            </div>
            <ButtonLink
              href={`/session/${runningSession}/play`}
              variant="primary"
              size="sm"
              trailingIcon="arrow-right"
            >
              Rejoin
            </ButtonLink>
          </motion.div>
        )}
      </AnimatePresence>

      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Join a session
      </h1>
      <p className="mt-2 text-muted">
        Enter the code on the host&apos;s screen.
      </p>

      <form action={submit} noValidate className="mt-10 flex flex-col gap-7">
        <Field id={codeId} label="Session code" error={errors.code}>
          <CodeInput
            id={codeId}
            value={code}
            onChange={(next) => {
              setCode(next);
              if (next.length === CODE_LENGTH && !name)
                nameRef.current?.focus();
            }}
            invalid={Boolean(errors.code)}
            aria-describedby={errors.code ? `${codeId}-error` : undefined}
            autoFocus={!initialCode}
            enterKeyHint="next"
          />
        </Field>
        <TextField
          ref={nameRef}
          label="Your name"
          hint="Shown on the leaderboard."
          autoComplete="nickname"
          maxLength={NAME_MAX}
          value={name}
          onChange={(event) => setName(event.target.value.slice(0, NAME_MAX))}
          error={errors.name}
          autoFocus={Boolean(initialCode)}
          enterKeyHint="go"
        />
        {errors.form && <Alert>{errors.form}</Alert>}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          trailingIcon="arrow-right"
          pending={pending}
          className="w-full"
        >
          {pending ? "Joining…" : "Join session"}
        </Button>
      </form>
    </>
  );
}
