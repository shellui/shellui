import { describe, expect, it } from 'vitest';
import {
  explainCapabilityDenial,
  isThirdPartyMessageAllowed,
  sanitizeCapabilityList,
} from './capabilities.js';

describe('sanitizeCapabilityList', () => {
  it('keeps theme and locale for third-party apps and drops auth', () => {
    expect(
      sanitizeCapabilityList(['storage', 'auth', 'childFrames', 'safeForAuthToken', 'ui'], true),
    ).toEqual(['theme', 'locale', 'ui', 'storage']);
  });

  it('can keep auth for a first-party grant', () => {
    expect(sanitizeCapabilityList(['auth', 'ui'], false)).toEqual(['ui', 'auth']);
  });
});

describe('explainCapabilityDenial', () => {
  it('refuses auth and child frames for third-party grants even if auth was stored', () => {
    const grant = { thirdParty: true, capabilities: new Set(['theme', 'locale', 'auth']) };
    expect(explainCapabilityDenial('SHELLUI_LOGIN', grant)).toMatch(/auth/);
    expect(explainCapabilityDenial('SHELLUI_LOGOUT', grant)).toMatch(/auth/);
    expect(explainCapabilityDenial('SHELLUI_UPDATE_PROFILE_REQUEST', grant)).toMatch(/auth/);
    expect(explainCapabilityDenial('SHELLUI_CHILD_FRAME_REGISTER', grant)).toMatch(/childFrames/);
  });

  it('refuses extra capabilities that were not granted', () => {
    const grant = { thirdParty: true, capabilities: new Set(['theme', 'locale']) };
    expect(explainCapabilityDenial('SHELLUI_DIALOG', grant)).toMatch(/ui/);
    expect(explainCapabilityDenial('SHELLUI_NAVIGATE', grant)).toMatch(/navigate/);
    expect(explainCapabilityDenial('SHELLUI_STORAGE_REQUEST', grant)).toMatch(/storage/);
    expect(explainCapabilityDenial('SHELLUI_AI_REQUEST', grant)).toMatch(/ai/);
    expect(explainCapabilityDenial('SHELLUI_SETTINGS_REQUESTED', grant)).toBeNull();
  });

  it('leaves static frames unrestricted when no grant is registered', () => {
    expect(explainCapabilityDenial('SHELLUI_LOGIN', null)).toBeNull();
  });
});

describe('third-party inbound allowlist', () => {
  const grant = { thirdParty: true, capabilities: new Set(['theme', 'locale', 'ui']) };

  it('accepts the handshake and the capabilities the app was granted', () => {
    for (const type of [
      'SHELLUI_INITIALIZED',
      'SHELLUI_SETTINGS_REQUESTED',
      'SHELLUI_CONTENT_SCROLL',
      'SHELLUI_TOAST',
      'SHELLUI_DIALOG',
    ]) {
      expect(explainCapabilityDenial(type, grant)).toBeNull();
    }
  });

  it('refuses settings updates, unknown types, and anything outside the grant', () => {
    expect(explainCapabilityDenial('SHELLUI_SETTINGS_UPDATED', grant)).toMatch(/cannot send/);
    expect(explainCapabilityDenial('SHELLUI_SETTINGS', grant)).toMatch(/cannot send/);
    expect(explainCapabilityDenial('SHELLUI_REFRESH_PAGE', grant)).toMatch(/cannot send/);
    expect(explainCapabilityDenial('SHELLUI_SOMETHING_NEW', grant)).toMatch(/cannot send/);
    expect(explainCapabilityDenial('SHELLUI_STORAGE_REQUEST', grant)).toMatch(/storage/);
    expect(explainCapabilityDenial('SHELLUI_LOGIN', grant)).toMatch(/auth/);
  });

  it('does not restrict first-party grants to the allowlist', () => {
    const first = { thirdParty: false, capabilities: new Set(['theme', 'locale']) };
    expect(explainCapabilityDenial('SHELLUI_SETTINGS_UPDATED', first)).toBeNull();
    expect(isThirdPartyMessageAllowed('SHELLUI_SETTINGS_UPDATED', new Set(['ui']))).not.toBeNull();
  });
});
