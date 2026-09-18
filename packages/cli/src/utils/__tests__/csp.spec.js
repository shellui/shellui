import { describe, expect, it } from 'vitest';
import {
  buildShellContentSecurityPolicy,
  computeThemeInitScriptHash,
  resolveShellCspHeaders,
} from '../csp.js';

describe('buildShellContentSecurityPolicy', () => {
  it('includes script hash for inline theme bootstrap', () => {
    const policy = buildShellContentSecurityPolicy({ useScriptHash: true });
    expect(policy).toContain(computeThemeInitScriptHash());
    expect(policy).toContain("script-src 'self'");
  });

  it('allows localhost companions in frame-src', () => {
    const policy = buildShellContentSecurityPolicy({ useScriptHash: true });
    expect(policy).toContain('frame-src');
    expect(policy).toContain('http://localhost:*');
  });

  it('adds backend origin to connect-src when configured', () => {
    const policy = buildShellContentSecurityPolicy({
      useScriptHash: true,
      backendUrl: 'http://localhost:8000',
    });
    expect(policy).toContain('http://localhost:8000');
  });
});

describe('resolveShellCspHeaders', () => {
  it('defaults to report-only (staged rollout)', () => {
    const headers = resolveShellCspHeaders({ security: { csp: {} } }, { useScriptHash: true });
    expect(headers['Content-Security-Policy-Report-Only']).toBeTruthy();
    expect(headers['Content-Security-Policy']).toBeUndefined();
  });

  it('can emit enforcing CSP when configured', () => {
    const headers = resolveShellCspHeaders(
      { security: { csp: { enforce: true, reportOnly: false } } },
      { useScriptHash: true },
    );
    expect(headers['Content-Security-Policy']).toBeTruthy();
    expect(headers['Content-Security-Policy-Report-Only']).toBeUndefined();
  });
});
