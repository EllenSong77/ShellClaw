import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Sandbox, Usage } from '../types';
import { api, clearToken, getToken } from '../api/client';

interface AuthState {
  user: User | null;
  sandbox: Sandbox | null;
  usage: Usage | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, activationCode?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  refreshSandbox: () => Promise<void>;
  refreshUsage: () => Promise<void>;
  restoreSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
  (set) => ({
    user: null,
    sandbox: null,
    usage: null,
    isLoading: false,
    error: null,
    isAuthenticated: false,

    login: async (email: string, password: string) => {
      set({ isLoading: true, error: null });
      try {
        await api.login(email, password);
        const user = await api.getMe();
        set({ user, isAuthenticated: true, isLoading: false });

        try {
          const [sandbox, usage] = await Promise.all([
            api.getSandbox(),
            api.getUsage(),
          ]);
          set({ sandbox, usage });
        } catch (err) {
          console.error('Failed to fetch sandbox/usage:', err);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Login failed';
        set({ error: message, isLoading: false, isAuthenticated: false });
        throw err;
      }
    },

    register: async (email: string, password: string, activationCode?: string) => {
      set({ isLoading: true, error: null });
      try {
        await api.register(email, password, activationCode);
        await api.login(email, password);
        const user = await api.getMe();
        set({ user, isAuthenticated: true, isLoading: false });

        try {
          const [sandbox, usage] = await Promise.all([
            api.getSandbox(),
            api.getUsage(),
          ]);
          set({ sandbox, usage });
        } catch (err) {
          console.error('Failed to fetch sandbox/usage:', err);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Registration failed';
        set({ error: message, isLoading: false, isAuthenticated: false });
        throw err;
      }
    },

    logout: () => {
      clearToken();
      set({ user: null, sandbox: null, usage: null, error: null, isAuthenticated: false });
    },

    refreshUser: async () => {
      try {
        const user = await api.getMe();
        set({ user, isAuthenticated: true });
      } catch (err) {
        console.error('Failed to refresh user:', err);
        set({ user: null, isAuthenticated: false });
      }
    },

    refreshSandbox: async () => {
      try {
        const sandbox = await api.getSandbox();
        set({ sandbox });
      } catch (err) {
        console.error('Failed to refresh sandbox:', err);
      }
    },

    refreshUsage: async () => {
      try {
        const usage = await api.getUsage();
        set({ usage });
      } catch (err) {
        console.error('Failed to refresh usage:', err);
      }
    },

    restoreSession: async () => {
      const token = getToken();
      if (!token) {
        set({ isAuthenticated: false });
        return;
      }

      set({ isLoading: true });
      try {
        const user = await api.getMe();
        set({ user, isAuthenticated: true, isLoading: false });

        try {
          const [sandbox, usage] = await Promise.all([
            api.getSandbox(),
            api.getUsage(),
          ]);
          set({ sandbox, usage });
        } catch (err) {
          console.error('Failed to fetch sandbox/usage:', err);
        }
      } catch (err) {
        console.error('Failed to restore session:', err);
        clearToken();
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    },

    clearError: () => set({ error: null }),
  }),
  {
    name: 'auth-storage',
    partialize: () => ({}),
  }
));
