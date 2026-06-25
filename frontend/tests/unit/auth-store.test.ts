import { useAuthStore } from '@/store/auth-store';
import { clearAuthSession, getAccessToken, getStoredUser, setAuthSession } from '@/lib/auth';

jest.mock('@/lib/auth', () => ({
  clearAuthSession: jest.fn(),
  getAccessToken: jest.fn(),
  getStoredUser: jest.fn(),
  setAuthSession: jest.fn(),
}));

// Valid JWT with far-future exp for hydrateFromStorage tests
const VALID_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZXhwIjo5OTk5OTk5OTk5fQ.test-signature';

describe('auth-store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false, hydrated: false });
  });

  it('sets auth and updates session', () => {
    const mockUser = { id: '1', email: 'test@example.com', role: 'USER' as const, is_active: true };
    const mockToken = VALID_JWT;

    useAuthStore.getState().setAuth(mockUser, mockToken);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.token).toEqual(mockToken);
    expect(state.isAuthenticated).toBe(true);

    expect(setAuthSession).toHaveBeenCalledWith(mockToken, mockUser);
  });

  it('hydrates from storage when user and token exist', () => {
    const mockUser = { id: '1', email: 'test@example.com', role: 'USER' as const, is_active: true };
    const mockToken = VALID_JWT;

    (getStoredUser as jest.Mock).mockReturnValue(mockUser);
    (getAccessToken as jest.Mock).mockReturnValue(mockToken);

    useAuthStore.getState().hydrateFromStorage();

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.token).toEqual(mockToken);
    expect(state.isAuthenticated).toBe(true);
    expect(state.hydrated).toBe(true);
  });

  it('hydrates from storage when no token exists', () => {
    (getStoredUser as jest.Mock).mockReturnValue(null);
    (getAccessToken as jest.Mock).mockReturnValue(null);

    useAuthStore.getState().hydrateFromStorage();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.hydrated).toBe(true);
  });

  it('logs out and clears session', () => {
    useAuthStore.setState({
      user: { id: '1', email: 'test@example.com', role: 'USER', is_active: true },
      token: VALID_JWT,
      isAuthenticated: true,
      hydrated: true,
    });

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.hydrated).toBe(true);

    expect(clearAuthSession).toHaveBeenCalled();
  });
});
