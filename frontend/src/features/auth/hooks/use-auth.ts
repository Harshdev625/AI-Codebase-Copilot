import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { authService } from "@/features/auth/services/auth-service";
import { useAuthStore } from "@/store/auth-store";
import { useToast } from "@/components/shared/toast-provider";
import { toApiError } from "@/core/api/errors";
import type { LoginPayload, RegisterPayload } from "@/features/auth/types/auth-types";
import {
  consumePendingOnboardingEmail,
  markBrandNewUser,
  markPendingOnboardingEmail,
} from "@/store/onboarding-store";
import { useNotificationStore } from "@/store/notification-store";

export const authKeys = {
  me: ["auth", "me"] as const,
};

export function useAuth() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrateFromStorage = useAuthStore((s) => s.hydrateFromStorage);
  const logout = useAuthStore((s) => s.logout);
  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();

  const login = (payload: LoginPayload) => {
    loginMutation.mutate(payload, {
      onSuccess: () => {
        const role = useAuthStore.getState().user?.role;
        if (role === "ADMIN") {
          router.replace("/admin/dashboard");
        } else {
          router.replace("/dashboard");
        }
      },
    });
  };

  const register = (payload: RegisterPayload) => {
    registerMutation.mutate(payload, {
      onSuccess: () => {
        router.replace("/login?registered=1");
      },
    });
  };

  return {
    user,
    token,
    isAuthenticated,
    hydrated,
    hydrateFromStorage,
    logout,
    login,
    register,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
  };
}

export function useLoginMutation() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const tokenPayload = await authService.login(payload);
      const me = await authService.me(tokenPayload.access_token);
      return { tokenPayload, me };
    },
    onSuccess: ({ tokenPayload, me }) => {
      const normalizedRole = String(me.role).toUpperCase() === "ADMIN" ? "ADMIN" : "USER";
      setAuth({ ...me, role: normalizedRole }, tokenPayload.access_token);
      useNotificationStore.getState().hydrateForUser(me.id);
      if (normalizedRole === "USER" && consumePendingOnboardingEmail(me.email)) {
        markBrandNewUser(me.id);
      }
      void queryClient.invalidateQueries({ queryKey: authKeys.me });
    },
    onError: (error) => {
      console.error("Login mutation error:", error);
      toast.error("Login Failed", toApiError(error));
    }
  });
}

export function useRegisterMutation() {
  const toast = useToast();

  return useMutation({
    mutationFn: (payload: RegisterPayload) => authService.register(payload),
    onSuccess: (_data, payload) => {
      markPendingOnboardingEmail(payload.email);
    },
    onError: (error) => {
      toast.error("Registration Failed", toApiError(error));
    },
  });
}

export function useMeQuery() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: authKeys.me,
    queryFn: () => authService.me(),
    enabled: hydrated && Boolean(token),
    staleTime: 60_000,
    retry: false,
  });
}

export type LogoutContext = "admin" | "user";

export function useLogout() {
  const router = useRouter();
  const logoutStore = useAuthStore((state) => state.logout);
  const queryClient = useQueryClient();

  return React.useCallback(
    (context?: LogoutContext) => {
      const role = useAuthStore.getState().user?.role;
      logoutStore();
      useNotificationStore.getState().hydrateForUser(null);
      void queryClient.clear();
      const toAdmin = role === "ADMIN" || context === "admin";
      router.replace(toAdmin ? "/admin/login" : "/login");
    },
    [router, logoutStore, queryClient]
  );
}

/** @deprecated Use useLogout instead */
export function useLogoutAction() {
  const logout = useLogout();
  return logout;
}
