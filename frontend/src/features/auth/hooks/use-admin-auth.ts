import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { authService } from "@/features/auth/services/auth-service";
import { useAuthStore } from "@/store/auth-store";
import type { AdminRegisterPayload, LoginPayload } from "@/features/auth/types/auth-types";
import { authKeys } from "@/features/auth/hooks/use-auth";

export function useAdminAuth() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: (payload: LoginPayload) => authService.adminLogin(payload),
    onSuccess: async (tokenPayload) => {
      const me = await authService.me(tokenPayload.access_token);
      const normalizedRole = String(me.role).toUpperCase() === "ADMIN" ? "ADMIN" : "USER";
      setAuth({ ...me, role: normalizedRole }, tokenPayload.access_token);
      void queryClient.invalidateQueries({ queryKey: authKeys.me });
    },
  });

  const registerMutation = useMutation({
    mutationFn: (payload: AdminRegisterPayload) => authService.adminRegister(payload),
  });

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
        router.replace("/admin/login");
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
