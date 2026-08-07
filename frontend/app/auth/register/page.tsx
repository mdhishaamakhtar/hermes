"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, HermesError } from "@/lib/api";
import { setStoredAuthToken } from "@/lib/auth-storage";
import MinimalNav from "@/components/MinimalNav";

interface RegisterState {
  error: string;
}

export default function RegisterPage() {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState<
    RegisterState,
    FormData
  >(
    async (_prev, formData) => {
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;
      const displayName = formData.get("displayName") as string;
      try {
        await api.post<{
          id: number;
          email: string;
          displayName: string;
          createdAt: string;
        }>(
          "/api/auth/register",
          { email, password, displayName },
          { skipAuth: true },
        );
      } catch (err) {
        if (err instanceof HermesError && err.isFromServer) {
          return { error: err.message || "Registration failed" };
        }
        return { error: "Connection failed" };
      }

      // The account exists now, so no failure past this point is worth an
      // error message — the worst case is signing in manually.
      try {
        const { token } = await api.post<{
          token: string;
          user: {
            id: number;
            email: string;
            displayName: string;
            createdAt: string;
          };
        }>("/api/auth/login", { email, password }, { skipAuth: true });
        setStoredAuthToken(token);
        // Full page load: resets the SWR cache and the Next.js router
        // cache so nothing fetched pre-login leaks into the new session.
        window.location.assign("/dashboard");
      } catch {
        router.push("/auth/login");
      }
      return { error: "" };
    },
    { error: "" },
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MinimalNav />

      <div className="flex-1 flex items-center justify-center px-6 relative z-[var(--z-raised)]">
        <div className="page-enter w-full max-w-sm">
          <div className="mb-8">
            <p className="label mb-2">New Organiser</p>
            <h1 className="text-2xl font-bold text-foreground leading-tight tracking-tight">
              Create Account
            </h1>
          </div>

          <form action={formAction} className="space-y-4">
            <div>
              <label htmlFor="register-name" className="field-label block mb-2">
                Display Name
              </label>
              <input
                id="register-name"
                type="text"
                name="displayName"
                required
                maxLength={100}
                className="input-field font-mono"
                placeholder="Your Name"
              />
            </div>
            <div>
              <label
                htmlFor="register-email"
                className="field-label block mb-2"
              >
                Email
              </label>
              <input
                id="register-email"
                type="email"
                name="email"
                required
                className="input-field font-mono"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label
                htmlFor="register-password"
                className="field-label block mb-2"
              >
                Password
              </label>
              <input
                id="register-password"
                type="password"
                name="password"
                required
                minLength={8}
                className="input-field font-mono"
                placeholder="Min. 8 characters"
              />
            </div>

            {state.error && (
              <p className="text-xs text-danger tracking-wide" role="alert">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-primary text-white py-4 text-sm tracking-widest uppercase font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {isPending ? "Creating..." : "Create Account"}
            </button>
          </form>

          <div className="mt-8 border-t border-border pt-6">
            <p className="text-sm text-muted">
              Have an account?{" "}
              <Link
                href="/auth/login"
                prefetch
                className="text-accent hover:text-accent-hover transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
