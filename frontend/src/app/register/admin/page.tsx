"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest, requireData } from "@/lib/http";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminRegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [adminSecretKey, setAdminSecretKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await apiRequest<{ id: string }>("/api/auth/admin/register", {
        method: "POST",
        body: {
          email,
          password,
          full_name: fullName || null,
          admin_secret_key: adminSecretKey,
        },
        withAuth: false,
      });
      requireData(result, "Admin registration failed");
      router.push("/admin/login");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Admin registration failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <div className="card w-full">
        <h1 className="text-xl font-semibold text-text">Admin registration</h1>
        <p className="mt-1 text-sm text-muted">Create an admin account using the admin secret key.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Full name</label>
            <Input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Platform Admin"
            />
          </div>

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
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Admin secret key</label>
            <Input
              type="password"
              required
              value={adminSecretKey}
              onChange={(event) => setAdminSecretKey(event.target.value)}
              placeholder="Configured in backend env"
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
            className="btn-primary w-full justify-center"
          >
            {loading ? "Creating..." : "Create admin account"}
          </Button>
        </form>

        <p className="mt-5 text-xs text-subtle">
          Already admin?{" "}
          <Link href="/admin/login" className="text-primary hover:text-primary-hover">
            Sign in
          </Link>
        </p>
        <p className="mt-2 text-xs text-subtle">
          Developer registration?{" "}
          <Link href="/register" className="text-primary hover:text-primary-hover">
            Back to user registration
          </Link>
        </p>
      </div>
    </div>
  );
}
