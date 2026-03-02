import type { AuthBackend } from './types';

const NOT_IMPLEMENTED_MESSAGE = 'ShellUI auth backend is not implemented yet.';

export const createShellUIAuthBackend = (): AuthBackend => ({
  type: 'shellui',
  readSessionFromCallback: () => {
    console.info('[auth:shellui] readSessionFromCallback not implemented');
    return null;
  },
  restoreSession: async () => {
    console.info('[auth:shellui] restoreSession not implemented');
    return null;
  },
  startOAuth: () => {
    console.info('[auth:shellui] startOAuth not implemented');
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  },
  logout: async () => {
    console.info('[auth:shellui] logout not implemented');
  },
  getAuthSettings: async () => {
    console.info('[auth:shellui] getAuthSettings not implemented');
    return { methods: [], oauthProviders: [] };
  },
  sendMagicLink: async () => {
    console.info('[auth:shellui] sendMagicLink not implemented');
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  },
});
