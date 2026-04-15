"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Lock, Mail, ShieldPlus, User2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/shared/toast-provider";
import { authService } from "@/features/auth/services/auth-service";

export default function AdminRegisterPage() {
  const router = useRouter();
  const toast = useToast();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [adminSecret, setAdminSecret] = React.useState("");
  const [error, setError] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await authService.register(
        {
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          admin_secret_key: adminSecret,
        },
        "/auth/admin/register"
      );

      toast.success("Admin Account Created", "You can now sign in to the admin control plane.");
      router.push("/admin/login");
    } catch (submitError: any) {
      const message = submitError?.message || "Admin registration failed";
      setError(message);
      toast.error("Admin Registration Failed", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[hsl(226,23%,6%)] px-4">
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-25" />
      <div className="pointer-events-none absolute left-0 top-0 h-72 w-72 rounded-full bg-cyan-500/12 blur-[90px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-indigo-500/12 blur-[90px]" />

      <div className="relative w-full max-w-lg rounded-3xl bg-zinc-950/65 p-8 shadow-[0_30px_80px_-40px_rgba(99,102,241,0.5)] backdrop-blur-xl">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-300">
            <ShieldPlus className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-indigo-300/70">Admin Enrollment</p>
            <h1 className="text-2xl font-bold text-zinc-100">Create Admin Account</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              type="email"
              placeholder="admin@company.com"
              className="h-11 border-0 bg-white/5 pl-10 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-indigo-400/30"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="relative">
            <User2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              type="text"
              placeholder="Full name"
              className="h-11 border-0 bg-white/5 pl-10 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-indigo-400/30"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
              autoComplete="name"
            />
          </div>

          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              type="password"
              placeholder="Password"
              className="h-11 border-0 bg-white/5 pl-10 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-indigo-400/30"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              type="password"
              placeholder="Admin secret key"
              className="h-11 border-0 bg-white/5 pl-10 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-indigo-400/30"
              value={adminSecret}
              onChange={(event) => setAdminSecret(event.target.value)}
              required
            />
          </div>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full border-0 bg-indigo-400 font-semibold text-zinc-950 hover:bg-indigo-300"
          >
            {isSubmitting ? "Creating account..." : "Create Admin Account"}
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-between text-xs text-zinc-400">
          <Link href="/admin/login" className="font-semibold text-indigo-300 hover:text-indigo-200">
            Back to admin login
          </Link>
          <Link href="/register" className="font-semibold text-zinc-300 hover:text-zinc-100">
            User signup
          </Link>
        </div>
      </div>
    </div>
  );
}
