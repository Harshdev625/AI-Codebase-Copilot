"use client";

import { AuthenticationAdminLoginForm } from "@/features/auth/components/auth-admin-login-form";

export default function AdminLoginPage() {
  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <AuthenticationAdminLoginForm />
    </div>
  );
}
