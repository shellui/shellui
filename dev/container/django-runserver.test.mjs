import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const shimPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'django-runserver.py');

/**
 * @param {string} code
 * @param {string[]} [args]
 * @param {Record<string, string | undefined>} [env]
 */
function runPython(code, args = [], env = {}) {
  const result = spawnSync('python3', ['-c', code, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'python subprocess failed');
  return result.stdout.trim();
}

/** @param {string[]} extraArgs */
function buildRunserverArgv(extraArgs) {
  const argsJson = JSON.stringify(extraArgs);
  const code = `
import importlib.util
import json
import sys

spec = importlib.util.spec_from_file_location("django_runserver", ${JSON.stringify(shimPath)})
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
extra = json.loads(sys.argv[1])
print(json.dumps(mod.build_runserver_argv(extra)))
`;
  return JSON.parse(runPython(code, [argsJson]));
}

/**
 * @param {string} settingsModule
 * @param {Record<string, string | undefined>} [env]
 */
function ensureSettingsFromManagePy(settingsModule, env = {}) {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'django-runserver-'));
  const managePy = path.join(tmpDir, 'manage.py');
  writeFileSync(
    managePy,
    `#!/usr/bin/env python
import os
import sys

def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "${settingsModule}")
    from django.core.management import execute_from_command_line
    execute_from_command_line(sys.argv)

if __name__ == "__main__":
    main()
`,
  );
  const code = `
import importlib.util
import json
import os
import sys

spec = importlib.util.spec_from_file_location("django_runserver", ${JSON.stringify(shimPath)})
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
manage_py = sys.argv[1]
mod.ensure_django_settings_module(__import__("pathlib").Path(manage_py))
print(json.dumps(os.environ.get("DJANGO_SETTINGS_MODULE")))
`;
  const stdout = runPython(code, [managePy], env);
  return { tmpDir, module: JSON.parse(stdout) };
}

test('build_runserver_argv defaults bind when no args are passed', () => {
  assert.deepEqual(buildRunserverArgv([]), ['manage.py', 'runserver', '0.0.0.0:8000']);
});

test('build_runserver_argv does not duplicate addrport from entrypoints', () => {
  assert.deepEqual(buildRunserverArgv(['0.0.0.0:8000']), [
    'manage.py',
    'runserver',
    '0.0.0.0:8000',
  ]);
});

test('build_runserver_argv preserves runserver flags without injecting addrport', () => {
  assert.deepEqual(buildRunserverArgv(['--noreload']), ['manage.py', 'runserver', '--noreload']);
});

test('ensure_django_settings_module reads default from manage.py', () => {
  const { module } = ensureSettingsFromManagePy('config.settings.dev');
  assert.equal(module, 'config.settings.dev');
});

test('ensure_django_settings_module leaves an existing env value unchanged', () => {
  const { module } = ensureSettingsFromManagePy('config.settings.dev', {
    DJANGO_SETTINGS_MODULE: 'already.configured',
  });
  assert.equal(module, 'already.configured');
});
