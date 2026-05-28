"use client";

import { AuthenticationLoginForm } from "@/features/auth/components/auth-login-form";

export default function LoginPage() {
  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <AuthenticationLoginForm />
    </div>
  );
}
