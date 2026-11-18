import { test, describe, beforeEach, afterEach, expect, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { writeCredentials, resetCredentialKeychainForTests } from '../../auth/credentials.js';
import { writeCliRegionalSessionFile } from '../../cli-context/session-file.js';
import { resolveRegionalCompanyScope } from '../../cli-context/company-scope.js';
import { redactSensitive } from '../../http/service-http.js';
import { projectsCommand } from '../projects.js';
import { storageBucketsCommand } from '../storage-buckets.js';
import { hostingDeploymentsCommand } from '../hosting-deployments.js';

const sessionFixture = {
  accessToken: 'access-test',
  refreshToken: 'refresh-test',
  backendUrl: 'https://id.example.com',
  companyId: '7',
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  tokenType: 'bearer',
};

vi.mock('../../auth/session.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadValidSession: vi.fn(),
  };
});

describe('AI-native CLI helpers', () => {
  /** @type {string} */
  let tmpHome;
  /** @type {string | undefined} */
  let prevXdg;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'shellui-cli-ai-'));
    prevXdg = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = path.join(tmpHome, 'xdg');
    resetCredentialKeychainForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = prevXdg;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  test('redactSensitive masks JWT-like fragments', () => {
    const s =
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    expect(redactSensitive(s)).not.toContain('eyJ');
    expect(redactSensitive(s)).toContain('***');
  });

  test('resolveRegionalCompanyScope uses explicit --company over config', () => {
    const dir = fs.mkdtempSync(path.join(tmpHome, 'proj-'));
    fs.writeFileSync(
      path.join(dir, 'shellui.config.json'),
      JSON.stringify({
        backend: { type: 'shellui', url: 'https://id.example.com', companyId: '1' },
      }),
    );
    const scope = resolveRegionalCompanyScope({ root: dir, company: '99' });
    expect(scope.companyId).toBe('99');
    expect(scope.source).toBe('flag');
  });

  test('resolveRegionalCompanyScope uses cli-session default when logged in', () => {
    writeCredentials({ ...sessionFixture, companyId: '42' }, { makeCurrent: true });
    writeCliRegionalSessionFile({
      backendUrl: sessionFixture.backendUrl,
      regionalCompanyId: '42',
    });
    const dir = fs.mkdtempSync(path.join(tmpHome, 'proj2-'));
    fs.writeFileSync(
      path.join(dir, 'shellui.config.json'),
      JSON.stringify({
        backend: { type: 'shellui', url: 'https://id.example.com', companyId: '1' },
      }),
    );
    const scope = resolveRegionalCompanyScope({ root: dir });
    expect(scope.companyId).toBe('42');
    expect(scope.source).toBe('cli-session');
  });

  test('projects list sends bearer to dashboard companies path, no company_id query', async () => {
    const dir = fs.mkdtempSync(path.join(tmpHome, 'proj3-'));
    fs.writeFileSync(
      path.join(dir, 'shellui.config.json'),
      JSON.stringify({
        backend: { type: 'shellui', url: 'https://id.example.com', companyId: '7' },
        saas: { url: 'http://localhost:8005' },
      }),
    );

    const { loadValidSession } = await import('../../auth/session.js');
    loadValidSession.mockResolvedValue({ ...sessionFixture });

    const fetchMock = vi.fn(async (url, init) => {
      expect(String(url)).toContain('/api/v1/companies');
      expect(String(url)).not.toMatch(/company_id=/);
      expect(init.headers.Authorization).toBe('Bearer access-test');
      return new Response(
        JSON.stringify([
          {
            id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            name: 'Alpha',
            slug: 'alpha',
          },
        ]),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const logs = [];
    const errSpy = vi.spyOn(console, 'error').mockImplementation((...a) => logs.push(a.join(' ')));
    const logSpy = vi.spyOn(console, 'log').mockImplementation((...a) => logs.push(a.join(' ')));

    await projectsCommand('list', undefined, { root: dir, json: false });

    errSpy.mockRestore();
    logSpy.mockRestore();

    const joined = logs.join('\n');
    expect(joined).not.toContain('access-test');
    expect(joined).not.toContain('refresh-test');
    expect(fetchMock).toHaveBeenCalled();
  });

  test('storage buckets list omits company_id query (JWT tenant)', async () => {
    const dir = fs.mkdtempSync(path.join(tmpHome, 'proj4-'));
    fs.writeFileSync(
      path.join(dir, 'shellui.config.json'),
      JSON.stringify({
        backend: { type: 'shellui', url: 'https://id.example.com', companyId: '7' },
        storage: { url: 'http://localhost:8001' },
      }),
    );

    const { loadValidSession } = await import('../../auth/session.js');
    loadValidSession.mockResolvedValue({ ...sessionFixture });

    const fetchMock = vi.fn(async (url) => {
      expect(String(url)).toContain('/storage/v1/bucket');
      expect(String(url)).not.toMatch(/company_id=/);
      return new Response(JSON.stringify([{ id: 'b1', name: 'company' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await storageBucketsCommand('list', undefined, { root: dir, company: '7', json: true });
    stdoutSpy.mockRestore();

    expect(fetchMock).toHaveBeenCalled();
  });

  test('hosting deployments list uses slug from config', async () => {
    const dir = fs.mkdtempSync(path.join(tmpHome, 'proj5-'));
    fs.writeFileSync(
      path.join(dir, 'shellui.config.json'),
      JSON.stringify({
        backend: { type: 'shellui', url: 'https://id.example.com', companyId: '7' },
        hosting: { url: 'http://localhost:8003', slug: 'my-preview' },
      }),
    );

    const { loadValidSession } = await import('../../auth/session.js');
    loadValidSession.mockResolvedValue({ ...sessionFixture });

    const fetchMock = vi.fn(async (url) => {
      expect(String(url)).toContain('/hosting/v1/apps/my-preview/deployments');
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await hostingDeploymentsCommand('list', undefined, { root: dir });

    expect(fetchMock).toHaveBeenCalled();
  });
});
