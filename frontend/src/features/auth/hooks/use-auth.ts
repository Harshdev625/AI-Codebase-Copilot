import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { authService } from '../services/auth-service';
import { LoginPayload, RegisterPayload } from '../types/auth-types';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/shared/toast-provider';
import { toApiError } from '@/lib/api';
import { setAccessToken } from '@/lib/auth';
import { consumePendingOnboardingEmail, markBrandNewUser, markPendingOnboardingEmail } from '@/store/onboarding-store';

export function useAuth() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const { setAuth, logout, user, isAuthenticated } = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: (payload: LoginPayload) => authService.login(payload),
    onSuccess: async (data) => {
      try {
        // Essential: Set token in store so 'me' request has it
        setAccessToken(data.access_token);
        useAuthStore.setState({ token: data.access_token });
        
        const profile = await authService.me();
        const shouldTriggerOnboarding =
          String(profile.role).toUpperCase() === 'USER' && consumePendingOnboardingEmail(profile.email);
        if (shouldTriggerOnboarding) {
          markBrandNewUser(profile.id);
        }

        setAuth(profile, data.access_token);
        
        toast.success('Welcome back!', `Logged in as ${profile.email}`);
        
        // Use a slight delay or reliable push
        setTimeout(() => {
          router.push('/dashboard');
          // Fallback if router fails in some race conditions
          setTimeout(() => {
            if (window.location.pathname !== '/dashboard') {
              window.location.href = '/dashboard';
            }
          }, 500);
        }, 100);
      } catch (error) {
        toast.error('Login Error', 'Failed to retrieve user profile');
      }
    },
    onError: (error) => {
      toast.error('Login Failed', toApiError(error));
    },
  });

  const registerMutation = useMutation({
    mutationFn: (payload: RegisterPayload) => authService.register(payload),
    onSuccess: (_data, variables) => {
      if (variables?.email) {
        markPendingOnboardingEmail(variables.email);
      }
      toast.success('Account Created', 'Please log in with your credentials.');
      setTimeout(() => {
        router.push('/login');
      }, 500);
    },
    onError: (error) => {
      toast.error('Registration Failed', toApiError(error));
    },
  });

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authService.me,
    enabled: !!useAuthStore.getState().token && !user,
    staleTime: Infinity,
  });

  const handleLogout = () => {
    logout();
    queryClient.clear();
    router.push('/login');
    toast.info('Logged Out', 'You have been successfully logged out.');
  };

  return {
    user,
    isAuthenticated,
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    register: registerMutation.mutate,
    isRegistering: registerMutation.isPending,
    logout: handleLogout,
    isLoadingProfile: meQuery.isLoading,
  };
}
