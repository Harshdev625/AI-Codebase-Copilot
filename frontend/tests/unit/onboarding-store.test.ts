import { useOnboardingStore, markPendingOnboardingEmail, consumePendingOnboardingEmail, markBrandNewUser } from '@/store/onboarding-store';

describe('onboarding-store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useOnboardingStore.setState({
      isOpen: false,
      currentStep: 0,
      isCompleted: false,
      activeUserId: null,
    });
  });

  describe('localStorage helpers', () => {
    it('marks and consumes pending onboarding email', () => {
      markPendingOnboardingEmail(' Test@Example.com ');
      expect(window.localStorage.getItem('tm.walkthrough.pendingUserEmail')).toBe('test@example.com');
      
      expect(consumePendingOnboardingEmail('other@example.com')).toBe(false);
      expect(consumePendingOnboardingEmail('TEST@example.com')).toBe(true);
      expect(window.localStorage.getItem('tm.walkthrough.pendingUserEmail')).toBeNull();
    });

    it('marks brand new user', () => {
      markBrandNewUser('user-1');
      expect(JSON.parse(window.localStorage.getItem('tm.walkthrough.brandNewByUser') || '{}')).toEqual({ 'user-1': true });
    });
  });

  describe('store methods', () => {
    it('initializeForUser handles brand new user', () => {
      markBrandNewUser('user-1');
      useOnboardingStore.getState().initializeForUser('user-1');
      
      const state = useOnboardingStore.getState();
      expect(state.isOpen).toBe(true);
      expect(state.isCompleted).toBe(false);
      expect(state.activeUserId).toBe('user-1');
      
      // brand new flag is consumed
      expect(JSON.parse(window.localStorage.getItem('tm.walkthrough.brandNewByUser') || '{}')).toEqual({});
    });

    it('initializeForUser handles existing user without brand new flag', () => {
      useOnboardingStore.getState().initializeForUser('user-2');
      
      const state = useOnboardingStore.getState();
      expect(state.isOpen).toBe(false);
      expect(state.isCompleted).toBe(true);
      expect(state.activeUserId).toBe('user-2');
      
      expect(JSON.parse(window.localStorage.getItem('tm.walkthrough.completedByUser') || '{}')).toEqual({ 'user-2': true });
    });

    it('initializeForUser handles null user', () => {
      useOnboardingStore.getState().initializeForUser(null);
      const state = useOnboardingStore.getState();
      expect(state.activeUserId).toBeNull();
    });

    it('nextStep and prevStep manage currentStep correctly', () => {
      useOnboardingStore.setState({ isOpen: true, currentStep: 0, isCompleted: false });
      
      useOnboardingStore.getState().nextStep();
      expect(useOnboardingStore.getState().currentStep).toBe(1);
      
      useOnboardingStore.getState().prevStep();
      expect(useOnboardingStore.getState().currentStep).toBe(0);
      
      useOnboardingStore.getState().prevStep(); // should not go below 0
      expect(useOnboardingStore.getState().currentStep).toBe(0);
      
      useOnboardingStore.getState().nextStep();
      useOnboardingStore.getState().nextStep();
      useOnboardingStore.getState().nextStep();
      // currentStep is 3, nextStep should complete
      useOnboardingStore.getState().nextStep();
      
      expect(useOnboardingStore.getState().isCompleted).toBe(true);
      expect(useOnboardingStore.getState().isOpen).toBe(false);
    });

    it('completeOnboarding closes and marks complete', () => {
      useOnboardingStore.setState({ activeUserId: 'user-3', isOpen: true, isCompleted: false });
      useOnboardingStore.getState().completeOnboarding();
      
      expect(useOnboardingStore.getState().isCompleted).toBe(true);
      expect(useOnboardingStore.getState().isOpen).toBe(false);
      expect(JSON.parse(window.localStorage.getItem('tm.walkthrough.completedByUser') || '{}')).toEqual({ 'user-3': true });
    });

    it('resetOnboarding clears completion', () => {
      useOnboardingStore.setState({ activeUserId: 'user-3', isOpen: false, isCompleted: true });
      useOnboardingStore.getState().resetOnboarding();
      
      expect(useOnboardingStore.getState().isCompleted).toBe(false);
      expect(useOnboardingStore.getState().isOpen).toBe(true);
      expect(useOnboardingStore.getState().currentStep).toBe(0);
      expect(JSON.parse(window.localStorage.getItem('tm.walkthrough.completedByUser') || '{}')).toEqual({ 'user-3': false });
    });

    it('openOnboarding opens if not completed', () => {
      useOnboardingStore.setState({ isOpen: false, isCompleted: false });
      useOnboardingStore.getState().openOnboarding();
      expect(useOnboardingStore.getState().isOpen).toBe(true);
    });
    
    it('closeOnboarding closes and marks completed', () => {
      useOnboardingStore.setState({ activeUserId: 'user-3', isOpen: true, isCompleted: false });
      useOnboardingStore.getState().closeOnboarding();
      
      expect(useOnboardingStore.getState().isCompleted).toBe(true);
      expect(useOnboardingStore.getState().isOpen).toBe(false);
    });
    
    it('dismissOnboarding closes and marks completed', () => {
      useOnboardingStore.setState({ activeUserId: 'user-3', isOpen: true, isCompleted: false });
      useOnboardingStore.getState().dismissOnboarding();
      
      expect(useOnboardingStore.getState().isCompleted).toBe(true);
      expect(useOnboardingStore.getState().isOpen).toBe(false);
    });
  });
});
