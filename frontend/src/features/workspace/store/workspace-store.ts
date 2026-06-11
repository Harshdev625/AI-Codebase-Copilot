import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getStoredUser } from '@/lib/auth';

export type WorkspaceTabType = 'code' | 'diff' | 'settings' | 'welcome' | 'patch-review' | 'admin' | 'chat';

export interface WorkspaceTab {
  id: string;
  type: WorkspaceTabType;
  title: string;
  filePath?: string;
  content?: string;
  initialLine?: number;
  isDirty?: boolean;
}

export type SidebarPanel = 'explorer' | 'search' | 'snapshots' | 'settings' | 'sessions' | 'tasks' | 'patches' | null;

export interface WorkspaceState {
  // Layout state
  activeSidebarPanel: SidebarPanel;
  setActiveSidebarPanel: (panel: SidebarPanel) => void;
  toggleSidebarPanel: (panel: SidebarPanel) => void;
  isChatOpen: boolean;
  setChatOpen: (isOpen: boolean) => void;

  // Domain state
  selectedRepositoryId: string | null;
  setSelectedRepositoryId: (id: string | null) => void;
  selectedSnapshotId: string | null;
  setSelectedSnapshotId: (id: string | null) => void;
  activePatchId: string | null;
  setActivePatchId: (id: string | null) => void;
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;

  // Search state
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: any[];
  setSearchResults: (results: any[]) => void;
  hasSearched: boolean;
  setHasSearched: (hasSearched: boolean) => void;

  // Tabs state
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  openTab: (tab: WorkspaceTab) => void;
  closeTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<WorkspaceTab>) => void;
  setActiveTabId: (tabId: string | null) => void;

  // Validation Actions
  validateHydration: (
    validRepos: string[], 
    validSessions: string[], 
    validPatches: string[], 
    validSnapshots: string[],
    validPaths: string[]
  ) => void;
}

const userScopedStorage = {
  getItem: (name: string) => {
    const userId = getStoredUser()?.id || 'guest';
    return localStorage.getItem(`${name}-${userId}`);
  },
  setItem: (name: string, value: string) => {
    const userId = getStoredUser()?.id || 'guest';
    localStorage.setItem(`${name}-${userId}`, value);
  },
  removeItem: (name: string) => {
    const userId = getStoredUser()?.id || 'guest';
    localStorage.removeItem(`${name}-${userId}`);
  }
};

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      activeSidebarPanel: 'sessions',
      setActiveSidebarPanel: (panel) => set({ activeSidebarPanel: panel }),
      toggleSidebarPanel: (panel) => set((state) => ({ 
        activeSidebarPanel: state.activeSidebarPanel === panel ? null : panel 
      })),
      isChatOpen: true,
      setChatOpen: (isOpen) => set({ isChatOpen: isOpen }),

      selectedRepositoryId: null,
      setSelectedRepositoryId: (id) => set((state) => {
        if (state.selectedRepositoryId === id) return {};
        const newTabs = state.tabs.filter(t => t.type === 'welcome' || t.type === 'admin');
        const newActiveTabId = newTabs.some(t => t.id === state.activeTabId) ? state.activeTabId : (newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
        
        return { 
          selectedRepositoryId: id,
          activeSessionId: null,
          activePatchId: null,
          selectedSnapshotId: null,
          tabs: newTabs,
          activeTabId: newActiveTabId,
          searchQuery: '',
          searchResults: [],
          hasSearched: false
        };
      }),
      selectedSnapshotId: null,
      setSelectedSnapshotId: (id) => set({ selectedSnapshotId: id }),
      activePatchId: null,
      setActivePatchId: (id) => set({ activePatchId: id }),
      activeSessionId: null,
      setActiveSessionId: (id) => set({ activeSessionId: id }),

      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),
      searchResults: [],
      setSearchResults: (results) => set({ searchResults: results }),
      hasSearched: false,
      setHasSearched: (hasSearched) => set({ hasSearched }),

      tabs: [],
      activeTabId: null,
      openTab: (tab) => set((state) => {
        const exists = state.tabs.find(t => t.id === tab.id);
        if (exists) {
          return { activeTabId: tab.id };
        }
        return { tabs: [...state.tabs, tab], activeTabId: tab.id };
      }),
      closeTab: (tabId) => set((state) => {
        const newTabs = state.tabs.filter(t => t.id !== tabId);
        let newActiveId = state.activeTabId;
        if (state.activeTabId === tabId) {
          newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
        }
        return { tabs: newTabs, activeTabId: newActiveId };
      }),
      updateTab: (tabId, updates) => set((state) => ({
        tabs: state.tabs.map(t => t.id === tabId ? { ...t, ...updates } : t)
      })),
      setActiveTabId: (tabId) => set({ activeTabId: tabId }),
      
      validateHydration: (validRepos, validSessions, validPatches, validSnapshots, validPaths) => set((state) => {
        const updates: Partial<WorkspaceState> = {};
        
        if (state.selectedRepositoryId && !validRepos.includes(state.selectedRepositoryId)) {
          updates.selectedRepositoryId = null;
          updates.activeSessionId = null;
          updates.activePatchId = null;
          updates.selectedSnapshotId = null;
          updates.tabs = state.tabs.filter(t => t.type === 'welcome' || t.type === 'admin');
          updates.activeTabId = updates.tabs.length > 0 ? updates.tabs[updates.tabs.length - 1].id : null;
          return updates; // Complete reset if repo invalid
        }
        
        if (state.activeSessionId && !validSessions.includes(state.activeSessionId)) {
          updates.activeSessionId = null;
        }
        
        if (state.activePatchId && !validPatches.includes(state.activePatchId)) {
          updates.activePatchId = null;
        }
        
        if (state.selectedSnapshotId && !validSnapshots.includes(state.selectedSnapshotId)) {
          updates.selectedSnapshotId = null;
        }
        
        let newTabs = state.tabs.filter(tab => {
           if (tab.type === 'patch-review' && !validPatches.includes(tab.id.replace('patch-', ''))) return false;
           return true;
        });
        
        if (newTabs.length !== state.tabs.length) {
           updates.tabs = newTabs;
           if (state.activeTabId && !newTabs.some(t => t.id === state.activeTabId)) {
             updates.activeTabId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
           }
        }
        
        return updates;
      }),
    }),
    {
      name: 'workspace-storage',
      storage: createJSONStorage(() => userScopedStorage),
      partialize: (state) => ({
        selectedRepositoryId: state.selectedRepositoryId,
        activeSessionId: state.activeSessionId,
        activeSidebarPanel: state.activeSidebarPanel,
        activeTabId: state.activeTabId,
        isChatOpen: state.isChatOpen,
        tabs: state.tabs.map(t => ({
           ...t,
           content: undefined, // Do not persist file contents
        })),
      }),
    }
  )
);
