import { create } from 'zustand';

interface UIState {
  isSidebarOpen: boolean;
  activeTheme: 'light' | 'dark' | 'system';
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: true,
  activeTheme: 'system',
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
  setTheme: (theme) => set({ activeTheme: theme }),
}));
