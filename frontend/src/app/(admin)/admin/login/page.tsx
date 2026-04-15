"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, LogIn, Mail, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/shared/toast-provider";
import { authService } from "@/features/auth/services/auth-service";
import { setAccessToken } from "@/lib/auth";
import { useAuthStore } from "@/store/auth-store";

export default function AdminLoginPage() {
  const router = useRouter();
  const toast = useToast();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const tokenResponse = await authService.login(
        { email: email.trim(), password },
        "/auth/admin/login"
      );

      setAccessToken(tokenResponse.access_token);
      const profile = await authService.me();
      if (String(profile.role).toUpperCase() !== "ADMIN") {
        throw new Error("Admin account required");
      }

      setAuth(profile, tokenResponse.access_token);
      toast.success("Admin Login Successful", `Welcome ${profile.email}`);

      router.push("/admin/dashboard");
      setTimeout(() => {
        if (window.location.pathname !== "/admin/dashboard") {
          window.location.href = "/admin/dashboard";
        }
      }, 400);
    } catch (submitError: any) {
      const message = submitError?.message || "Admin login failed";
      setError(message);
      toast.error("Admin Login Failed", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[hsl(226,23%,6%)] px-4">
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-25" />
      <div className="pointer-events-none absolute -left-24 top-12 h-72 w-72 rounded-full bg-cyan-500/15 blur-[90px]" />
      <div className="pointer-events-none absolute -right-16 bottom-8 h-64 w-64 rounded-full bg-indigo-500/12 blur-[90px]" />

      <div className="relative w-full max-w-md rounded-3xl bg-zinc-950/65 p-8 shadow-[0_30px_80px_-40px_rgba(34,211,238,0.5)] backdrop-blur-xl">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300/70">Admin Access</p>
            <h1 className="text-2xl font-bold text-zinc-100">Control Plane Login</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              type="email"
              placeholder="admin@company.com"
              className="h-11 border-0 bg-white/5 pl-10 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-cyan-400/30"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="h-11 border-0 bg-white/5 pl-10 pr-10 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-cyan-400/30"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((previous) => !previous)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-300"
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full border-0 bg-cyan-400 font-semibold text-zinc-950 hover:bg-cyan-300"
          >
            <LogIn className="mr-2 h-4 w-4" />
            {isSubmitting ? "Signing in..." : "Sign In as Admin"}
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-between text-xs text-zinc-400">
          <Link href="/admin/register" className="font-semibold text-cyan-300 hover:text-cyan-200">
            Create admin account
          </Link>
          <Link href="/login" className="font-semibold text-zinc-300 hover:text-zinc-100">
            User login
          </Link>
        </div>
      </div>
    </div>
  );
}
