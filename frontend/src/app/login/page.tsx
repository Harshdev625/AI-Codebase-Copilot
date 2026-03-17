"use client";

import { FormEvent, useState } from "react";
import { Code2, GitBranch, Zap, Shield, Eye, EyeOff } from "lucide-react";
import { storeSession } from "@/lib/auth";

const FEATURES = [
  { icon: GitBranch, label: "Index any GitHub repo",     desc: "Point to a remote URL and let the AI parse, chunk and embed your entire codebase." },
  { icon: Zap,       label: "Instant semantic search",   desc: "Find functions, classes, and logic patterns with natural language queries."        },
  { icon: Shield,    label: "Admin & RBAC controls",     desc: "Multi-tenant projects with role-based access for teams of any size."               },
];

export default function LoginPage() {
  const [email,      setEmail]      = useState("admin@aicc.dev");
  const [password,   setPassword]   = useState("password123");
  const [showPass,   setShowPass]   = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [loading,    setLoading]    = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/auth/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Login failed");
      await storeSession(data.access_token);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Left: Branding panel ─────────────────────────────────── */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-surface p-10 lg:flex lg:w-[45%]">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 bg-hero-glow" />
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-accent/5 blur-3xl" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-dim ring-1 ring-primary/30">
            <Code2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-base font-bold tracking-tight text-text">AI Codebase Copilot</p>
            <p className="text-xs text-subtle">Powered by Ollama · Qdrant · LangGraph</p>
          </div>
        </div>

        {/* Features */}
        <div className="relative space-y-6">
          <div>
            <h2 className="text-3xl font-bold leading-tight tracking-tight text-text">
              Understand any<br />
              <span className="text-primary">codebase instantly</span>
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Agentic RAG platform for code search, debugging, refactoring, and auto-documentation.
            </p>
          </div>

          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex gap-4">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface3 ring-1 ring-border">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text">{label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative text-xs text-subtle">
          © 2026 AI Codebase Copilot · Production build
        </p>
      </div>

      {/* ── Right: Login form ─────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-dim ring-1 ring-primary/30">
            <Code2 className="h-5 w-5 text-primary" />
          </div>
          <p className="text-lg font-bold text-text">AI Codebase Copilot</p>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-text">Welcome back</h1>
            <p className="mt-1.5 text-sm text-muted">Sign in to your account to continue.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Email address</label>
              <input
                type="email"
                required
                autoComplete="email"
                className="input-base"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  className="input-base pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle transition-colors hover:text-muted"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-danger/30 bg-danger-dim px-3 py-2 text-xs text-danger">
                {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 text-sm">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Signing in…
                </span>
              ) : "Sign in"}
            </button>
          </form>

          {/* Register link */}
          <p className="mt-6 text-center text-xs text-subtle">
            No account?{" "}
            <a href="/register" className="text-primary transition-colors hover:text-primary-hover">
              Create one
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

