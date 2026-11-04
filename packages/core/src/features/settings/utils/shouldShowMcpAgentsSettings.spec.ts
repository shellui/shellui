import { describe, expect, it } from 'vitest';
import type { ShellUIConfig } from '../../config/types';
import { shouldShowMcpAgentsSettings } from './shouldShowMcpAgentsSettings';

const shellWithAiService: ShellUIConfig = {
  aiService: { url: 'https://ai.example.com' },
  backend: { type: 'shellui', url: 'https://id.example.com', companyId: 1 },
} as ShellUIConfig;

describe('shouldShowMcpAgentsSettings', () => {
  it('is false when aiService url is missing', () => {
    expect(
      shouldShowMcpAgentsSettings({
        config: {
          ai: { enabled: true },
          backend: { type: 'shellui', url: 'https://id.example.com' },
        } as ShellUIConfig,
        isAuthenticated: true,
        mcpEnabled: true,
      }),
    ).toBe(false);
  });

  it('is false when the user is signed out', () => {
    expect(
      shouldShowMcpAgentsSettings({
        config: shellWithAiService,
        isAuthenticated: false,
        mcpEnabled: true,
      }),
    ).toBe(false);
  });

  it('is false while MCP status is unknown', () => {
    expect(
      shouldShowMcpAgentsSettings({
        config: shellWithAiService,
        isAuthenticated: true,
        mcpEnabled: null,
      }),
    ).toBe(false);
  });

  it('is true when aiService, auth, backend, and MCP are ready', () => {
    expect(
      shouldShowMcpAgentsSettings({
        config: shellWithAiService,
        isAuthenticated: true,
        mcpEnabled: true,
      }),
    ).toBe(true);
  });

  it('treats whitespace-only aiService url as unset', () => {
    expect(
      shouldShowMcpAgentsSettings({
        config: {
          aiService: { url: '   ' },
          backend: { type: 'shellui', url: 'https://id.example.com' },
        } as ShellUIConfig,
        isAuthenticated: true,
        mcpEnabled: true,
      }),
    ).toBe(false);
  });
});
