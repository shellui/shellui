import { getLogger } from '@shellui/sdk';
import type { AuthBackend } from './types';

const NOT_IMPLEMENTED_MESSAGE = 'ShellUI auth backend is not implemented yet.';
const logger = getLogger('shellcore');

export const createShellUIAuthBackend = (): AuthBackend => ({
  type: 'shellui',
  readSessionFromCallback: () => {
    logger.info('readSessionFromCallback not implemented (shellui auth backend)');
    return null;
  },
  restoreSession: async () => {
    logger.info('restoreSession not implemented (shellui auth backend)');
    return null;
  },
  startOAuth: () => {
    logger.info('startOAuth not implemented (shellui auth backend)');
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  },
  logout: async () => {
    logger.info('logout not implemented (shellui auth backend)');
  },
  getAuthSettings: async () => {
    logger.info('getAuthSettings not implemented (shellui auth backend)');
    return { methods: [], oauthProviders: [] };
  },
  sendMagicLink: async () => {
    logger.info('sendMagicLink not implemented (shellui auth backend)');
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  },
  syncUserPreferences: async () => {
    logger.info('syncUserPreferences not implemented (shellui auth backend)');
  },
});
