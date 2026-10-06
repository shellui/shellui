import { describe, expect, it } from 'vitest';
import type { ShellUIConfig } from '../../config/types';
import { shouldShowStorageSettings } from './shouldShowStorageSettings';

const withStorage = {
  storage: { url: 'http://localhost:8001' },
} as ShellUIConfig;

describe('shouldShowStorageSettings', () => {
  it('shows when remote storage is configured and the user is signed in', () => {
    expect(
      shouldShowStorageSettings({
        config: withStorage,
        isAuthenticated: true,
        aiEnabled: false,
      }),
    ).toBe(true);
  });

  it('hides remote storage when the user is signed out', () => {
    expect(
      shouldShowStorageSettings({
        config: withStorage,
        isAuthenticated: false,
        aiEnabled: false,
      }),
    ).toBe(false);
  });

  it('shows when AI is enabled even without remote storage', () => {
    expect(
      shouldShowStorageSettings({
        config: undefined,
        isAuthenticated: false,
        aiEnabled: true,
      }),
    ).toBe(true);
  });

  it('hides when AI is off and remote storage is not configured', () => {
    expect(
      shouldShowStorageSettings({
        config: {} as ShellUIConfig,
        isAuthenticated: true,
        aiEnabled: false,
      }),
    ).toBe(false);
  });
});
