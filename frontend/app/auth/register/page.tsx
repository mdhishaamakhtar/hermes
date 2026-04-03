"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
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
        const regRes = await api.post<{
          id: number;
          email: string;
          displayName: string;
          createdAt: string;
        }>(
          "/api/auth/register",
          { email, password, displayName },
          { skipAuth: true },
        );
        if (!regRes.success) {
          return { error: regRes.error?.message || "Registration failed" };
        }
        const loginRes = await api.post<{
          token: string;
          user: {
            id: number;
            email: string;
            displayName: string;
            createdAt: string;
          };
        }>("/api/auth/login", { email, password }, { skipAuth: true });
        if (loginRes.success) {
          setStoredAuthToken(loginRes.data.token);
          router.push("/dashboard");
        } else {
          router.push("/auth/login");
        }
        return { error: "" };
      } catch {
        return { error: "Connection failed" };
      }
    },
    { error: "" },
  );

  return (
    <div className="scanlines min-h-screen bg-background flex flex-col">
      <MinimalNav />

      <div className="flex-1 flex items-center justify-center px-6 relative z-10">
        <div className="page-enter w-full max-w-sm">
          <div className="mb-8">
            <p className="label mb-2">New Organiser</p>
            <h1 className="text-2xl font-bold text-foreground leading-tight tracking-tight">
              Create Account
            </h1>
          </div>

          <form action={formAction} className="space-y-4">
            <div>
              <label className="field-label block mb-2">Display Name</label>
              <input
                type="text"
                name="displayName"
                required
                maxLength={100}
                className="input-field font-mono"
                placeholder="Your Name"
              />
            </div>
            <div>
              <label className="field-label block mb-2">Email</label>
              <input
                type="email"
                name="email"
                required
                className="input-field font-mono"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="field-label block mb-2">Password</label>
              <input
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
