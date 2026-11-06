import { describe, expect, it } from 'vitest';
import { MCP_ACTIVITY_ERROR_CODES, type McpActivityErrorCode } from './personalAgentsApi';
import { MCP_ACTIVITY_ERROR_CODE_I18N_KEYS } from './mcpActivityErrorCodeI18n';
import en from '../../i18n/translations/en/settings.json';
import fr from '../../i18n/translations/fr/settings.json';

function enLabel(path: string): string {
  const parts = path.split('.');
  let cur: unknown = en;
  for (const p of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return '';
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === 'string' ? cur : '';
}

describe('MCP_ACTIVITY_ERROR_CODE_I18N_KEYS', () => {
  it('has one non-empty en label per allowlisted code', () => {
    for (const code of MCP_ACTIVITY_ERROR_CODES) {
      const key = MCP_ACTIVITY_ERROR_CODE_I18N_KEYS[code as McpActivityErrorCode];
      expect(key, `missing i18n key mapping for ${code}`).toBeTruthy();
      const label = enLabel(key);
      expect(label.length, `empty en label for ${code} at ${key}`).toBeGreaterThan(0);
    }
  });

  it('fr keys mirror en structure for errorCode', () => {
    const enErr = en.mcpAgents.activity.detail.errorCode;
    const frErr = fr.mcpAgents.activity.detail.errorCode;
    expect(Object.keys(enErr).sort()).toEqual(Object.keys(frErr).sort());
  });
});
