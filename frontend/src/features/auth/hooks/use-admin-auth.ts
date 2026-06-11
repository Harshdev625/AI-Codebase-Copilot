import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { authService } from "@/features/auth/services/auth-service";
import { useAuthStore } from "@/store/auth-store";
import { useToast } from "@/components/shared/toast-provider";
import { toApiError } from "@/core/api/errors";
import type { AdminRegisterPayload, LoginPayload } from "@/features/auth/types/auth-types";
import { authKeys } from "@/features/auth/hooks/use-auth";

export function useAdminAuth() {
  const router = useRouter();
  const loginMutation = useAdminLoginMutation();
  const registerMutation = useAdminRegisterMutation();

  const login = (payload: LoginPayload) => {
    loginMutation.mutate(payload, {
      onSuccess: () => {
        router.replace("/admin/dashboard");
      },
    });
  };

  const register = (payload: AdminRegisterPayload) => {
    registerMutation.mutate(payload, {
      onSuccess: () => {
        router.replace("/admin/login?registered=1");
      },
    });
  };

  return {
    login,
    register,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
  };
}

export function useAdminLoginMutation() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const tokenPayload = await authService.adminLogin(payload);
      const me = await authService.me(tokenPayload.access_token);
      return { tokenPayload, me };
    },
    onSuccess: ({ tokenPayload, me }) => {
      const normalizedRole = String(me.role).toUpperCase() === "ADMIN" ? "ADMIN" : "USER";
      setAuth({ ...me, role: normalizedRole }, tokenPayload.access_token);
      void queryClient.invalidateQueries({ queryKey: authKeys.me });
    },
    onError: (error) => {
      console.error("Admin login mutation error:", error);
      toast.error("Admin Login Failed", toApiError(error));
    }
  });
}

export function useAdminRegisterMutation() {
  const toast = useToast();

  return useMutation({
    mutationFn: (payload: AdminRegisterPayload) => authService.adminRegister(payload),
    onError: (error) => {
      toast.error("Admin Registration Failed", toApiError(error));
    }
  });
}
