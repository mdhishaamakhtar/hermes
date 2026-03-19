"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import MinimalNav from "@/components/MinimalNav";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{
        token: string;
        user: { id: number; email: string; displayName: string; createdAt: string };
      }>("/api/auth/login", { email, password }, { skipAuth: true });
      if (res.success) {
        login(res.data.token, res.data.user);
        router.push("/dashboard");
      } else {
        setError(res.error?.message || "Invalid credentials");
      }
    } catch {
      setError("Connection failed");
    } finally {
      setLoading(false);
    }
  };

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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label block mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-field font-mono"
                placeholder="organiser@example.com"
              />
            </div>
            <div>
              <label className="label block mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input-field font-mono"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-xs text-danger tracking-wide" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-3 text-sm tracking-widest uppercase font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              style={{ boxShadow: loading ? "none" : "0 0 20px rgba(37,99,235,0.3)" }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-muted">
              No account?{" "}
              <Link href="/auth/register" className="text-accent hover:text-accent-hover transition-colors">
                Create one
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
