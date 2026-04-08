"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, UserPlus } from "lucide-react";

import { ErrorState } from "@/components/shared/error-state";
import { useToast } from "@/components/shared/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, toApiError } from "@/lib/api";

export default function RegisterPage(): React.JSX.Element {
  const toast = useToast();
  const router = useRouter();
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setSubmitting] = React.useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      toast.error("Validation failed", "Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await api.auth.register({
        email,
        password,
        full_name: fullName || undefined,
      });
      toast.success("Account created", "Sign in with your new credentials.");
      router.push("/login");
    } catch (requestError) {
      const message = toApiError(requestError);
      setError(message);
      toast.error("Registration failed", message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md animate-fade-up">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Create account
        </CardTitle>
        <CardDescription>Set up your workspace access credentials.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground" htmlFor="full-name">
              Full name
            </label>
            <Input
              id="full-name"
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Alex Carter"
            />
          </div>

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
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground" htmlFor="confirm-password">
              Confirm password
            </label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>

          {error ? <ErrorState message={error} /> : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="mt-5 text-sm text-muted-foreground">
          Already registered?{" "}
          <Link className="inline-flex items-center gap-1 font-semibold text-primary hover:underline" href="/login">
            Sign in
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
