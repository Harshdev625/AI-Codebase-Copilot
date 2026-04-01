"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { storeSession } from "@/lib/auth";
import { apiRequest, requireData } from "@/lib/http";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LoginResponse {
  access_token: string;
  token_type?: string;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await apiRequest<LoginResponse>("/api/auth/admin/login", {
        method: "POST",
        body: { email, password },
        withAuth: false,
      });
      const data = requireData(result, "Admin login failed");

      await storeSession(data.access_token);
      router.push("/admin/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Admin login failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <div className="card w-full">
        <h1 className="text-xl font-semibold text-text">Admin sign in</h1>
        <p className="mt-1 text-sm text-muted">Use an existing admin account.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Email</label>
            <Input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Password</label>
            <Input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-danger/30 bg-danger-dim px-3 py-2 text-xs text-danger">
              {error}
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={loading}
            className="w-full justify-center"
          >
            {loading ? "Signing in..." : "Admin sign in"}
          </Button>
        </form>

        <p className="mt-5 text-xs text-subtle">
          Need to create admin account?{" "}
          <Link href="/admin/register" className="text-primary hover:text-primary-hover">
            Register admin
          </Link>
        </p>
        <p className="mt-2 text-xs text-subtle">
          Developer login?{" "}
          <Link href="/login" className="text-primary hover:text-primary-hover">
            Back to user sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
