import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Faction } from '@veilfall/shared';

interface Player {
  id: string;
  username: string;
  faction: Faction;
  email?: string;
}

interface AuthState {
  player: Player | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (player: Player, token: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      player: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      login: (player, token, refreshToken) =>
        set({ player, token, refreshToken, isAuthenticated: true }),
      logout: () =>
        set({ player: null, token: null, refreshToken: null, isAuthenticated: false }),
    }),
    { name: 'veilfall-auth' },
  ),
);
