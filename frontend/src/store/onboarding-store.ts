import { create } from 'zustand';

export interface OnboardingState {
  isOpen: boolean;
  currentStep: number;
  isCompleted: boolean;
  activeUserId: string | null;
  initializeForUser: (userId?: string | null) => void;
  openOnboarding: () => void;
  closeOnboarding: () => void;
  nextStep: () => void;
  prevStep: () => void;
  completeOnboarding: () => void;
  dismissOnboarding: () => void;
  resetOnboarding: () => void;
}

const TOTAL_STEPS = 4;
const COMPLETED_WALKTHROUGH_KEY = 'tm.walkthrough.completedByUser';
const BRAND_NEW_USER_KEY = 'tm.walkthrough.brandNewByUser';
const PENDING_ONBOARDING_EMAIL_KEY = 'tm.walkthrough.pendingUserEmail';

const isBrowser = () => typeof window !== 'undefined';

const readCompletionMap = (): Record<string, boolean> => {
  if (!isBrowser()) {
    return {};
  }

  const raw = window.localStorage.getItem(COMPLETED_WALKTHROUGH_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, boolean>;
    }
  } catch {
    return {};
  }

  return {};
};

const writeCompletionMap = (value: Record<string, boolean>) => {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(COMPLETED_WALKTHROUGH_KEY, JSON.stringify(value));
};

const hasCompletedForUser = (userId: string) => {
  const completionMap = readCompletionMap();
  return Boolean(completionMap[userId]);
};

const markCompletedForUser = (userId: string, completed = true) => {
  const completionMap = readCompletionMap();
  completionMap[userId] = completed;
  writeCompletionMap(completionMap);
};

const readBrandNewMap = (): Record<string, boolean> => {
  if (!isBrowser()) {
    return {};
  }

  const raw = window.localStorage.getItem(BRAND_NEW_USER_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, boolean>;
    }
  } catch {
    return {};
  }

  return {};
};

const writeBrandNewMap = (value: Record<string, boolean>) => {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(BRAND_NEW_USER_KEY, JSON.stringify(value));
};

const consumeBrandNewForUser = (userId: string): boolean => {
  const brandNewMap = readBrandNewMap();
  if (!brandNewMap[userId]) {
    return false;
  }
  delete brandNewMap[userId];
  writeBrandNewMap(brandNewMap);
  return true;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const markPendingOnboardingEmail = (email: string) => {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(PENDING_ONBOARDING_EMAIL_KEY, normalizeEmail(email));
};

export const consumePendingOnboardingEmail = (email: string): boolean => {
  if (!isBrowser()) {
    return false;
  }
  const pendingEmail = window.localStorage.getItem(PENDING_ONBOARDING_EMAIL_KEY);
  const normalized = normalizeEmail(email);
  if (pendingEmail && pendingEmail === normalized) {
    window.localStorage.removeItem(PENDING_ONBOARDING_EMAIL_KEY);
    return true;
  }
  return false;
};

export const markBrandNewUser = (userId: string) => {
  const brandNewMap = readBrandNewMap();
  brandNewMap[userId] = true;
  writeBrandNewMap(brandNewMap);
};

export const useOnboardingStore = create<OnboardingState>()((set, get) => ({
  isOpen: false,
  currentStep: 0,
  isCompleted: false,
  activeUserId: null,

  initializeForUser: (userId) => {
    if (!userId) {
      set({ activeUserId: null, isOpen: false, currentStep: 0, isCompleted: false });
      return;
    }

    const completed = hasCompletedForUser(userId);
    const brandNew = consumeBrandNewForUser(userId);

    if (!completed && !brandNew) {
      // Existing accounts must not auto-open onboarding on login.
      markCompletedForUser(userId, true);
      set({
        activeUserId: userId,
        isCompleted: true,
        isOpen: false,
        currentStep: 0,
      });
      return;
    }

    set({
      activeUserId: userId,
      isCompleted: completed,
      isOpen: !completed && brandNew,
      currentStep: 0,
    });
  },

  openOnboarding: () => {
    const { isCompleted } = get();
    if (!isCompleted) {
      set({ isOpen: true, currentStep: 0 });
    }
  },

  closeOnboarding: () => {
    const { activeUserId } = get();
    if (activeUserId) {
      markCompletedForUser(activeUserId, true);
    }
    set({ isOpen: false, isCompleted: true });
  },

  nextStep: () => {
    const { currentStep } = get();
    if (currentStep >= TOTAL_STEPS - 1) {
      const { activeUserId } = get();
      if (activeUserId) {
        markCompletedForUser(activeUserId, true);
      }
      set({ isCompleted: true, isOpen: false });
    } else {
      set({ currentStep: currentStep + 1 });
    }
  },

  prevStep: () => {
    const { currentStep } = get();
    if (currentStep > 0) set({ currentStep: currentStep - 1 });
  },

  completeOnboarding: () => {
    const { activeUserId } = get();
    if (activeUserId) {
      markCompletedForUser(activeUserId, true);
    }
    set({ isCompleted: true, isOpen: false });
  },

  dismissOnboarding: () => {
    const { activeUserId } = get();
    if (activeUserId) {
      markCompletedForUser(activeUserId, true);
    }
    set({ isCompleted: true, isOpen: false });
  },

  resetOnboarding: () => {
    const { activeUserId } = get();
    if (activeUserId) {
      markCompletedForUser(activeUserId, false);
    }
    set({ isOpen: true, currentStep: 0, isCompleted: false });
  },
}));
