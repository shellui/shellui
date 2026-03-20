import type { LoginMethod } from '../types';

// Checks whether a value is a supported auth login method.
export const isLoginMethod = (value: unknown): value is LoginMethod =>
  value === 'password' || value === 'oauth' || value === 'magic_link' || value === 'web3';
