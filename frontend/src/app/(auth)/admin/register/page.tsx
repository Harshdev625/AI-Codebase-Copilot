"use client";

import { AuthenticationAdminRegisterForm } from "@/features/auth/components/auth-admin-register-form";

export default function AdminRegisterPage() {
  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <AuthenticationAdminRegisterForm />
    </div>
  );
}
