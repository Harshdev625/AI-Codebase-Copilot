"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { storeSession } from "@/lib/auth";

type ApiResponse = {
  access_token?: string;
  detail?: string;
};

export default function RegisterPage(): React.JSX.Element {
  const router = useRouter();
  const [fullName, setFullName] = React.useState("");
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
      const registerResponse = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: fullName,
          email,
          password,
        }),
      });

      const registerPayload = (await registerResponse.json().catch(() => ({}))) as ApiResponse;
      if (!registerResponse.ok) {
        throw new Error(registerPayload.detail || "Registration failed");
      }

      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const loginPayload = (await loginResponse.json().catch(() => ({}))) as ApiResponse;
      if (!loginResponse.ok || !loginPayload.access_token) {
        throw new Error(loginPayload.detail || "Login failed");
      }

      await storeSession(loginPayload.access_token);
      router.push("/dashboard");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section>
      <h1>Create account</h1>
      <form onSubmit={onSubmit}>
        <input
          placeholder="Your name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <input
          type="password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button type="submit" disabled={isSubmitting}>
          Create account
        </button>
      </form>
      {error ? <p>{error}</p> : null}
    </section>
  );
}
