import { render, screen, fireEvent } from '@testing-library/react';

import { WelcomeTab } from '@/features/studio/workbench/welcome-tab';
import { useStudioStore } from '@/features/studio/store/studio-store';
import { TestProviders } from '../test-utils';

const mockFocusSidebar = jest.fn();
const mockSetAiPanelOpen = jest.fn();
const mockOpenWelcomeTab = jest.fn();

jest.mock('@/features/studio/store/studio-store', () => ({
  useStudioStore: jest.fn(),
}));

jest.mock('@/features/repositories/hooks/use-repositories', () => ({
  useRepositories: jest.fn(() => ({
    repositories: [{ id: 'repo-1', repo_id: 'org/my-app', default_branch: 'main' }],
    isLoading: false,
  })),
}));

describe('WelcomeTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useStudioStore as unknown as jest.Mock).mockImplementation((selector?: (s: unknown) => unknown) => {
      const state = {
        selectedRepositoryId: 'repo-1',
        focusSidebar: mockFocusSidebar,
        setAiPanelOpen: mockSetAiPanelOpen,
        openWelcomeTab: mockOpenWelcomeTab,
      };
      return typeof selector === 'function' ? selector(state) : state;
    });
  });

  it('renders repository name and quick actions', () => {
    render(
      <TestProviders>
        <WelcomeTab />
      </TestProviders>,
    );

    expect(screen.getByTestId('welcome-tab')).toBeInTheDocument();
    expect(screen.getByText('my-app')).toBeInTheDocument();
    expect(screen.getByText('Open Explorer')).toBeInTheDocument();
    expect(screen.getByText('Search Codebase')).toBeInTheDocument();
    expect(mockOpenWelcomeTab).toHaveBeenCalled();
  });

  it('focuses explorer when Open Explorer clicked', () => {
    render(
      <TestProviders>
        <WelcomeTab />
      </TestProviders>,
    );

    fireEvent.click(screen.getByText('Open Explorer'));
    expect(mockFocusSidebar).toHaveBeenCalledWith('explorer');
  });

  it('prompts dashboard when no repository selected', () => {
    (useStudioStore as unknown as jest.Mock).mockImplementation((selector?: (s: unknown) => unknown) => {
      const state = {
        selectedRepositoryId: null,
        focusSidebar: mockFocusSidebar,
        setAiPanelOpen: mockSetAiPanelOpen,
        openWelcomeTab: mockOpenWelcomeTab,
      };
      return typeof selector === 'function' ? selector(state) : state;
    });

    render(
      <TestProviders>
        <WelcomeTab />
      </TestProviders>,
    );

    expect(screen.getByText('Codebase Studio')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Add a repository/i })).toHaveAttribute('href', '/dashboard');
  });
});
