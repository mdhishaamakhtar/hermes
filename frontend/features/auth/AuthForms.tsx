"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { PasswordField, TextField } from "@/components/ui/Field";
import { api, describeError, errorStatus } from "@/lib/api";
import { safeReturnPath, setStoredAuthToken } from "@/lib/auth";

const MIN_PASSWORD = 8;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface LoginResponse {
  token: string;
}

/**
 * Store the new token, drop anything cached under the previous account, and
 * go where the organiser was headed before login interrupted them.
 */
function useSignIn(next: string | null) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  return async (email: string, password: string) => {
    const { token } = await api.post<LoginResponse>(
      "/api/auth/login",
      { email, password },
      { skipAuth: true },
    );
    setStoredAuthToken(token);
    await mutate(() => true, undefined, { revalidate: false });
    router.replace(safeReturnPath(next));
  };
}

function AuthHeading({ title, lead }: { title: string; lead: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-2 text-muted">{lead}</p>
    </div>
  );
}

function PlayerNote() {
  return (
    <p className="mt-3 text-sm text-subtle">
      Joining a quiz? Players don&apos;t need an account.{" "}
      <Link
        href="/join"
        className="font-medium text-muted underline decoration-border-strong underline-offset-4 transition-colors hover:text-foreground"
      >
        Enter your code
      </Link>
    </p>
  );
}

export function LoginForm({ next }: { next: string | null }) {
  const signIn = useSignIn(next);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, submit, pending] = useActionState<string | null>(async () => {
    if (!EMAIL_SHAPE.test(email.trim()) || !password) {
      return "Enter your email and password.";
    }
    try {
      await signIn(email.trim(), password);
      return null;
    } catch (err) {
      return errorStatus(err) === 401
        ? "That email and password don't match a host account."
        : describeError(err, "Couldn't sign you in.");
    }
  }, null);

  const registerHref = next
    ? `/auth/register?next=${encodeURIComponent(next)}`
    : "/auth/register";

  return (
    <>
      <AuthHeading
        title="Sign in"
        lead="Welcome back. Your events and quizzes are waiting."
      />
      <form action={submit} noValidate className="flex flex-col gap-5">
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="font-mono"
          autoFocus
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && <Alert>{error}</Alert>}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          pending={pending}
          className="mt-1 w-full"
        >
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <div className="mt-8 border-t border-border pt-6">
        <p className="text-sm text-muted">
          New to Hermes?{" "}
          <Link
            href={registerHref}
            className="font-medium text-accent transition-colors hover:text-accent-hover"
          >
            Create a host account
          </Link>
        </p>
        <PlayerNote />
      </div>
    </>
  );
}

type RegisterErrors = Partial<
  Record<"name" | "email" | "password" | "form", string>
>;

export function RegisterForm({ next }: { next: string | null }) {
  const router = useRouter();
  const signIn = useSignIn(next);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errors, submit, pending] = useActionState<RegisterErrors>(async () => {
    const invalid: RegisterErrors = {};
    if (!name.trim()) invalid.name = "Tell us what to call you.";
    if (!EMAIL_SHAPE.test(email.trim())) {
      invalid.email = "Enter an email address like you@example.com.";
    }
    if (password.length < MIN_PASSWORD) {
      invalid.password = `Use at least ${MIN_PASSWORD} characters.`;
    }
    if (Object.keys(invalid).length > 0) return invalid;

    try {
      await api.post(
        "/api/auth/register",
        { displayName: name.trim(), email: email.trim(), password },
        { skipAuth: true },
      );
    } catch (err) {
      return { form: describeError(err, "Couldn't create your account.") };
    }

    // The account exists now. If signing in fails, the login page can
    // finish the job; there is nothing left to correct here.
    try {
      await signIn(email.trim(), password);
    } catch {
      router.replace("/auth/login");
    }
    return {};
  }, {});

  const loginHref = next
    ? `/auth/login?next=${encodeURIComponent(next)}`
    : "/auth/login";

  return (
    <>
      <AuthHeading
        title="Create a host account"
        lead="Build quizzes, then run them live for any room."
      />
      <form action={submit} noValidate className="flex flex-col gap-5">
        <TextField
          label="Your name"
          name="displayName"
          autoComplete="name"
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
          autoFocus
        />
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
          className="font-mono"
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="new-password"
          hint={`At least ${MIN_PASSWORD} characters.`}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
        {errors.form && <Alert>{errors.form}</Alert>}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          pending={pending}
          className="mt-1 w-full"
        >
          {pending ? "Creating your account…" : "Create account"}
        </Button>
      </form>
      <div className="mt-8 border-t border-border pt-6">
        <p className="text-sm text-muted">
          Already have an account?{" "}
          <Link
            href={loginHref}
            className="font-medium text-accent transition-colors hover:text-accent-hover"
          >
            Sign in
          </Link>
        </p>
        <PlayerNote />
      </div>
    </>
  );
}
