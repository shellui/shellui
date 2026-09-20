import { describe, expect, it } from 'vitest';
import {
  AI_CSP_CONNECT_SRC,
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

  it('does not widen AI hosts when aiEnabled is false', () => {
    const policy = buildShellContentSecurityPolicy({
      useScriptHash: true,
      aiEnabled: false,
    });
    expect(policy).not.toContain('huggingface.co');
    expect(policy).not.toContain("'wasm-unsafe-eval'");
    expect(policy).not.toContain('worker-src');
  });

  it('adds Ollama, HF, worker-src, and wasm-unsafe-eval when AI is enabled', () => {
    const policy = buildShellContentSecurityPolicy({
      useScriptHash: true,
      aiEnabled: true,
    });
    expect(policy).toContain('http://127.0.0.1:*');
    expect(policy).toContain('http://localhost:*');
    for (const host of AI_CSP_CONNECT_SRC) {
      expect(policy).toContain(host);
    }
    expect(policy).toContain("'wasm-unsafe-eval'");
    expect(policy).toContain("worker-src 'self' blob:");
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

  it('includes AI CSP extras by default (ai.enabled omitted)', () => {
    const headers = resolveShellCspHeaders({ security: { csp: {} } }, { useScriptHash: true });
    const policy = headers['Content-Security-Policy-Report-Only'];
    expect(policy).toContain('huggingface.co');
    expect(policy).toContain("'wasm-unsafe-eval'");
  });

  it('omits AI CSP extras when ai.enabled is false', () => {
    const headers = resolveShellCspHeaders(
      { ai: { enabled: false }, security: { csp: {} } },
      { useScriptHash: true },
    );
    const policy = headers['Content-Security-Policy-Report-Only'];
    expect(policy).not.toContain('huggingface.co');
    expect(policy).not.toContain("'wasm-unsafe-eval'");
  });
});
