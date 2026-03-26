import type { BackendConfig } from '../../config/types';
import { createShellUIAuthBackend } from './shellui';
import { createSupabaseAuthBackend } from './supabase';
import type { AuthBackend } from './types';

const createNoopBackend = (): AuthBackend => ({
  type: 'none',
  readSessionFromCallback: () => null,
  restoreSession: async () => null,
  startOAuth: () => {
    throw new Error('No auth backend configured.');
  },
  startWeb3Ethereum: async () => {
    throw new Error('No auth backend configured.');
  },
  logout: async () => {},
  getAuthSettings: async () => ({ methods: [], oauthProviders: [] }),
  sendMagicLink: async () => {
    throw new Error('No auth backend configured.');
  },
  syncUserPreferences: async () => {},
  loadUserPreferences: async () => null,
});

export const createAuthBackend = (backendConfig: BackendConfig | undefined): AuthBackend => {
  if (!backendConfig) return createNoopBackend();
  if (backendConfig.type === 'shellui') {
    return createShellUIAuthBackend({
      backendUrl: backendConfig.url?.replace(/\/+$/, '') ?? null,
    });
  }
  if (backendConfig.type === 'supabase') {
    return createSupabaseAuthBackend({
      backendUrl: backendConfig.url?.replace(/\/+$/, '') ?? null,
      publishableKey: backendConfig.publishableKey,
    });
  }
  return createNoopBackend();
};
