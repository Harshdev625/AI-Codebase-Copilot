"use client";

import { AuthenticationRegisterForm } from "@/features/auth/components/auth-register-form";

export default function RegisterPage() {
  return (
    <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
      <AuthenticationRegisterForm />
    </div>
  );
}
