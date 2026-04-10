import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface OnboardingState {
  isOpen: boolean;
  currentStep: number;
  isCompleted: boolean;
  openOnboarding: () => void;
  closeOnboarding: () => void;
  nextStep: () => void;
  prevStep: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

const TOTAL_STEPS = 4;

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      currentStep: 0,
      isCompleted: false,

      openOnboarding: () => set({ isOpen: true, currentStep: 0 }),
      closeOnboarding: () => set({ isOpen: false }),

      nextStep: () => {
        const { currentStep } = get();
        if (currentStep >= TOTAL_STEPS - 1) {
          set({ isCompleted: true, isOpen: false });
        } else {
          set({ currentStep: currentStep + 1 });
        }
      },

      prevStep: () => {
        const { currentStep } = get();
        if (currentStep > 0) set({ currentStep: currentStep - 1 });
      },

      completeOnboarding: () => set({ isCompleted: true, isOpen: false }),
      resetOnboarding: () => set({ isOpen: true, currentStep: 0, isCompleted: false }),
    }),
    {
      name: 'ai-copilot-onboarding-v1',
    }
  )
);
