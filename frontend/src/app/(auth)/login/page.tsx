"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, toApiError } from "@/lib/api";
import { clearAuthSession, isAdmin, setAccessToken, setStoredUser } from "@/lib/auth";

export default function LoginPage(): React.JSX.Element {
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
      router.refresh();
    } catch (requestError) {
      clearAuthSession();
      setError(toApiError(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md animate-fade-up">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
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

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="mt-5 text-sm text-muted-foreground">
          New account?{" "}
          <Link className="font-semibold text-primary hover:underline" href="/register">
            Register
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
