"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import MinimalNav from "@/components/MinimalNav";

interface LoginState {
  error: string;
}

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [state, formAction, isPending] = useActionState<LoginState, FormData>(
    async (_prev, formData) => {
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;
      try {
        const res = await api.post<{
          token: string;
          user: {
            id: number;
            email: string;
            displayName: string;
            createdAt: string;
          };
        }>("/api/auth/login", { email, password }, { skipAuth: true });
        if (res.success) {
          login(res.data.token, res.data.user);
          router.push("/dashboard");
          return { error: "" };
        }
        return { error: res.error?.message || "Invalid credentials" };
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
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8">
            <p className="label mb-2">Organiser Access</p>
            <h1 className="text-2xl font-bold text-foreground leading-tight tracking-tight">
              Sign In
            </h1>
          </div>

          <form action={formAction} className="space-y-4">
            <div>
              <label className="field-label block mb-2">Email</label>
              <input
                type="email"
                name="email"
                required
                className="input-field font-mono"
                placeholder="organiser@example.com"
              />
            </div>
            <div>
              <label className="field-label block mb-2">Password</label>
              <input
                type="password"
                name="password"
                required
                className="input-field font-mono"
                placeholder="••••••••"
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
              {isPending ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-8 border-t border-border pt-6">
            <p className="text-sm text-muted">
              No account?{" "}
              <Link
                href="/auth/register"
                className="text-accent hover:text-accent-hover transition-colors"
              >
                Create one
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
