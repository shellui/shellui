import { describe, expect, it } from 'vitest';
import type { ShellUIConfig } from '../../config/types';
import { shouldShowMcpAgentsSettings } from './shouldShowMcpAgentsSettings';

const shellWithAi: ShellUIConfig = {
  ai: { enabled: true },
  backend: { type: 'shellui', url: 'https://id.example.com', companyId: 1 },
} as ShellUIConfig;

describe('shouldShowMcpAgentsSettings', () => {
  it('is false when config AI is off', () => {
    expect(
      shouldShowMcpAgentsSettings({
        config: { backend: { type: 'shellui', url: 'https://id.example.com' } } as ShellUIConfig,
        isAuthenticated: true,
        mcpEnabled: true,
      }),
    ).toBe(false);
  });

  it('is false when the user is signed out', () => {
    expect(
      shouldShowMcpAgentsSettings({
        config: shellWithAi,
        isAuthenticated: false,
        mcpEnabled: true,
      }),
    ).toBe(false);
  });

  it('is false while MCP status is unknown', () => {
    expect(
      shouldShowMcpAgentsSettings({
        config: shellWithAi,
        isAuthenticated: true,
        mcpEnabled: null,
      }),
    ).toBe(false);
  });

  it('is true when AI, auth, backend, and MCP are ready', () => {
    expect(
      shouldShowMcpAgentsSettings({
        config: shellWithAi,
        isAuthenticated: true,
        mcpEnabled: true,
      }),
    ).toBe(true);
  });
});
