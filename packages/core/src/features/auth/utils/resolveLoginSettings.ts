import type { BackendConfig } from '../../config/types';
import type { AuthSettings, LoginMethod } from '../types';
import { isLoginMethod } from './isLoginMethod';

const BACKENDS_WITH_MAGIC_LINK = new Set(['shellui', 'supabase']);

/**
 * Login methods and OAuth providers to show, from `backend.login` in the shell config.
 * When no method is listed, falls back to magic link (plus OAuth if providers are listed)
 * so a configured backend never shows an empty login page.
 */
export function resolveLoginSettings(backend: BackendConfig | undefined): AuthSettings {
  const login = backend?.login;
  const methods = Array.isArray(login?.methods) ? login.methods.filter(isLoginMethod) : [];
  const providers = Array.isArray(login?.oauthProviders)
    ? Array.from(
        new Set(
          login.oauthProviders
            .filter(
              (provider): provider is string =>
                typeof provider === 'string' && provider.trim() !== '',
            )
            .map((provider) => provider.toLowerCase()),
        ),
      )
    : [];

  if (methods.length > 0 || !backend?.type || !BACKENDS_WITH_MAGIC_LINK.has(backend.type)) {
    return { methods, oauthProviders: providers, oauthClients: [] };
  }
  const fallback: LoginMethod[] = providers.length > 0 ? ['oauth', 'magic_link'] : ['magic_link'];
  return { methods: fallback, oauthProviders: providers, oauthClients: [] };
}
