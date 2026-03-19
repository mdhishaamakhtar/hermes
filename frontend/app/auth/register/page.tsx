"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import MinimalNav from "@/components/MinimalNav";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const regRes = await api.post<{
        id: number; email: string; displayName: string; createdAt: string;
      }>("/api/auth/register", { email, password, displayName }, { skipAuth: true });
      if (!regRes.success) {
        setError(regRes.error?.message || "Registration failed");
        return;
      }
      const loginRes = await api.post<{
        token: string;
        user: { id: number; email: string; displayName: string; createdAt: string };
      }>("/api/auth/login", { email, password }, { skipAuth: true });
      if (loginRes.success) {
        login(loginRes.data.token, loginRes.data.user);
        router.push("/dashboard");
      } else {
        router.push("/auth/login");
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
            <p className="label mb-2">New Organiser</p>
            <h1 className="text-2xl font-bold text-foreground leading-tight tracking-tight">
              Create Account
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label block mb-2">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                maxLength={100}
                className="input-field font-mono"
                placeholder="Your Name"
              />
            </div>
            <div>
              <label className="label block mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-field font-mono"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="label block mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="input-field font-mono"
                placeholder="Min. 8 characters"
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
              {loading ? "Creating..." : "Create Account"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-muted">
              Have an account?{" "}
              <Link href="/auth/login" className="text-accent hover:text-accent-hover transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
