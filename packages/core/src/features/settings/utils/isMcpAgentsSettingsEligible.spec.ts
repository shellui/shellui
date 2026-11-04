import { describe, expect, it } from 'vitest';
import type { ShellUIConfig } from '../../config/types';
import { isMcpAgentsSettingsEligible } from './isMcpAgentsSettingsEligible';

const shellWithAiService: ShellUIConfig = {
  aiService: { url: 'https://ai.example.com' },
  backend: { type: 'shellui', url: 'https://id.example.com', companyId: 1 },
} as ShellUIConfig;

describe('isMcpAgentsSettingsEligible', () => {
  it('is true when aiService, auth, and shellui backend are present', () => {
    expect(isMcpAgentsSettingsEligible({ config: shellWithAiService, isAuthenticated: true })).toBe(
      true,
    );
  });

  it('is false when aiService url is missing', () => {
    expect(
      isMcpAgentsSettingsEligible({
        config: { backend: { type: 'shellui', url: 'https://id.example.com' } } as ShellUIConfig,
        isAuthenticated: true,
      }),
    ).toBe(false);
  });
});
