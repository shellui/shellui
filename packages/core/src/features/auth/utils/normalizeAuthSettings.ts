import type { AuthSettings, LoginMethod } from '../types';
import { isLoginMethod } from './isLoginMethod';

const NON_OAUTH_EXTERNAL_PROVIDERS = new Set(['email', 'phone', 'sms']);
const WEB3_EXTERNAL_PROVIDERS = new Set(['ethereum', 'solana', 'web3_ethereum', 'web3_solana']);

// Normalizes auth settings payloads into supported login methods and providers.
export const normalizeAuthSettings = (payload: unknown): AuthSettings => {
  const record = Array.isArray(payload) ? payload[0] : payload;
  if (!record || typeof record !== 'object') {
    return { methods: [], oauthProviders: [], oauthClients: [] };
  }

  const obj = record as Record<string, unknown>;
  const methodsFromArray = Array.isArray(obj.methods) ? obj.methods.filter(isLoginMethod) : [];
  const methods = new Set<LoginMethod>(methodsFromArray);
  const oauthProvidersSet = new Set<string>();
  const oauthClients: AuthSettings['oauthClients'] = [];

  if (isLoginMethod(obj.loginMethod)) methods.add(obj.loginMethod);
  if (obj.loginMethod === 'both') {
    methods.add('password');
    methods.add('oauth');
  }
  if (obj.enable_password === true) methods.add('password');
  if (obj.enable_oauth === true) methods.add('oauth');
  if (obj.enable_magic_link === true) methods.add('magic_link');
  if (obj.enable_web3 === true) methods.add('web3');

  if (obj.external && typeof obj.external === 'object') {
    const external = obj.external as Record<string, unknown>;
    const enabledProviders = Object.entries(external)
      .filter(([, enabled]) => enabled === true)
      .map(([provider]) => provider);
    if (enabledProviders.length > 0) methods.add('oauth');
    enabledProviders
      .filter((provider) => !NON_OAUTH_EXTERNAL_PROVIDERS.has(provider.toLowerCase()))
      .forEach((provider) => oauthProvidersSet.add(provider.toLowerCase()));
    if (enabledProviders.some((provider) => WEB3_EXTERNAL_PROVIDERS.has(provider.toLowerCase()))) {
      methods.add('web3');
    }
    if (external.email === true || obj.disable_signup === false) methods.add('magic_link');
  }

  if (Array.isArray(obj.oauthProviders)) {
    obj.oauthProviders
      .filter((provider): provider is string => typeof provider === 'string')
      .forEach((provider) => oauthProvidersSet.add(provider.toLowerCase()));
  }
  if (typeof obj.oauth_provider === 'string') {
    oauthProvidersSet.add(obj.oauth_provider.toLowerCase());
  }
  if (Array.isArray(obj.oauthClients)) {
    obj.oauthClients.forEach((row) => {
      if (!row || typeof row !== 'object') return;
      const item = row as Record<string, unknown>;
      const id = Number(item.id);
      const provider = typeof item.provider === 'string' ? item.provider.toLowerCase().trim() : '';
      const label = typeof item.label === 'string' ? item.label.trim() : '';
      if (!Number.isInteger(id) || id <= 0 || !provider || !label) return;
      oauthClients.push({ id, provider, label });
      oauthProvidersSet.add(provider);
    });
  }

  return {
    methods: Array.from(methods),
    oauthProviders: Array.from(oauthProvidersSet),
    oauthClients,
  };
};
