"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { storeSession } from "@/lib/auth";
import { apiRequest, requireData } from "@/lib/http";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const registerResult = await apiRequest<{ id: string }>("/api/auth/register", {
        method: "POST",
        body: { email, password, full_name: fullName || null },
        withAuth: false,
      });
      requireData(registerResult, "Registration failed");

      const loginResult = await apiRequest<{ access_token: string }>("/api/auth/login", {
        method: "POST",
        body: { email, password },
        withAuth: false,
      });
      const loginData = requireData(loginResult, "Login failed");

      await storeSession(loginData.access_token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <div className="card w-full">
        <h1 className="text-xl font-semibold text-text">Create account</h1>
        <p className="mt-1 text-sm text-muted">Register and continue to your dashboard.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Full name</label>
            <Input
              type="text"
              placeholder="Your name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Email</label>
            <Input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Password</label>
            <Input
              type="password"
              required
              minLength={8}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <div className="rounded-lg border border-danger/30 bg-danger-dim px-3 py-2 text-xs text-danger">{error}</div>}

          <Button type="submit" disabled={loading} className="w-full justify-center">
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="mt-5 text-xs text-subtle">
          Already have an account? <Link href="/login" className="text-primary hover:text-primary-hover">Sign in</Link>
        </p>
        <p className="mt-2 text-xs text-subtle">
          Admin account setup? <Link href="/admin/register" className="text-primary hover:text-primary-hover">Register admin</Link>
        </p>
      </div>
    </div>
  );
}
