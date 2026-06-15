import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingWalkthrough } from '@/features/onboarding/components/onboarding-walkthrough';
import { useOnboardingStore } from '@/store/onboarding-store';
import { useAuthStore } from '@/store/auth-store';

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

describe('OnboardingWalkthrough', () => {
  beforeEach(() => {
    useOnboardingStore.setState({
      isOpen: true,
      currentStep: 0,
      isCompleted: false,
      activeUserId: 'user-1',
    });
    useAuthStore.setState({
      user: { id: 'user-1', email: 'user@example.com', role: 'USER', is_active: true } as any,
      hydrated: true,
      isAuthenticated: true,
      token: 'token',
    });
  });

  it('renders first step and advances on next', () => {
    render(<OnboardingWalkthrough />);
    expect(screen.getByTestId('onboarding-walkthrough')).toBeInTheDocument();
    expect(screen.getByText(/Welcome to AI Codebase Copilot/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('onboarding-next'));
    expect(useOnboardingStore.getState().currentStep).toBe(1);
  });

  it('dismisses tour on skip', () => {
    render(<OnboardingWalkthrough />);
    fireEvent.click(screen.getByTestId('onboarding-skip'));
    expect(useOnboardingStore.getState().isCompleted).toBe(true);
    expect(useOnboardingStore.getState().isOpen).toBe(false);
  });
});
