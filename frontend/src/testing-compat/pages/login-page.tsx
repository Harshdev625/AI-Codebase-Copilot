"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { storeSession } from "@/lib/auth";

type LoginResponse = {
  access_token?: string;
  detail?: string;
};

export default function LoginPage(): React.JSX.Element {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [isSubmitting, setSubmitting] = React.useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const payload = (await response.json().catch(() => ({}))) as LoginResponse;

      if (!response.ok || !payload.access_token) {
        throw new Error(payload.detail || "Login failed");
      }

      const user = await storeSession(payload.access_token);
      const role = String(user?.role || "").toUpperCase();
      router.push(role === "ADMIN" ? "/admin" : "/dashboard");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section>
      <h1>Welcome back</h1>
      <form onSubmit={onSubmit}>
        <input
          aria-label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <input
          aria-label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button type="submit" disabled={isSubmitting}>
          Sign in
        </button>
      </form>
      {error ? <p>{error}</p> : null}
    </section>
  );
}
