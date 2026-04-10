import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { authService } from '../services/auth-service';
import { LoginPayload, RegisterPayload } from '../types/auth-types';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/shared/toast-provider';
import { getApiErrorMessage } from '@/api/api-client';

export function useAuth() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const { setAuth, logout, user, isAuthenticated } = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: authService.login,
    onSuccess: async (data) => {
      try {
        // Essential: Set token in store so 'me' request has it
        useAuthStore.setState({ token: data.access_token });
        
        const profile = await authService.me();
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
        console.error('Login profile fetch failed:', error);
        toast.error('Login Error', 'Failed to retrieve user profile');
      }
    },
    onError: (error) => {
      toast.error('Login Failed', getApiErrorMessage(error));
    },
  });

  const registerMutation = useMutation({
    mutationFn: authService.register,
    onSuccess: () => {
      toast.success('Account Created', 'Please log in with your credentials.');
      setTimeout(() => {
        router.push('/login');
      }, 500);
    },
    onError: (error) => {
      toast.error('Registration Failed', getApiErrorMessage(error));
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
