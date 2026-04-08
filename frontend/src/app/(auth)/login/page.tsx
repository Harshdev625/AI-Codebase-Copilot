"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LogIn } from "lucide-react";

import { ErrorState } from "@/components/shared/error-state";
import { useToast } from "@/components/shared/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, toApiError } from "@/lib/api";
import { clearAuthSession, isAdmin, setAccessToken, setStoredUser } from "@/lib/auth";

export default function LoginPage(): React.JSX.Element {
  const toast = useToast();
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setSubmitting] = React.useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const tokenResponse = await api.auth.login({ email, password });
      setAccessToken(tokenResponse.access_token);
      const user = await api.auth.me();
      setStoredUser(user);
      router.push(isAdmin(user.role) ? "/admin/dashboard" : "/dashboard");
      toast.success("Signed in", "Welcome back.");
    } catch (requestError) {
      clearAuthSession();
      const message = toApiError(requestError);
      setError(message);
      toast.error("Sign in failed", message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md animate-fade-up">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LogIn className="h-5 w-5" />
          Sign in
        </CardTitle>
        <CardDescription>Access your AI Codebase Copilot workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground" htmlFor="password">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error ? <ErrorState message={error} /> : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="mt-5 text-sm text-muted-foreground">
          New account?{" "}
          <Link className="inline-flex items-center gap-1 font-semibold text-primary hover:underline" href="/register">
            Register
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
