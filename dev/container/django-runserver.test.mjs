import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
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
 * @param {{ env?: Record<string, string | undefined>; withConfigPackage?: boolean }} [options]
 */
function fixtureManagePyProject(settingsModule, options = {}) {
  const { env = {}, withConfigPackage = false } = options;
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
  if (withConfigPackage) {
    mkdirSync(path.join(tmpDir, 'config'), { recursive: true });
    writeFileSync(path.join(tmpDir, 'config', '__init__.py'), '');
    writeFileSync(
      path.join(tmpDir, 'config', 'settings.py'),
      'SECRET_KEY = "test"\nDEBUG = True\n',
    );
  }
  return { tmpDir, managePy, env };
}

/**
 * @param {string} prepareFn
 * @param {string} managePy
 * @param {Record<string, string | undefined>} env
 */
function runManagePyPrepare(prepareFn, managePy, env) {
  const code = `
import importlib
import importlib.util
import json
import os
import sys

spec = importlib.util.spec_from_file_location("django_runserver", ${JSON.stringify(shimPath)})
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
manage_py = sys.argv[1]
mod.${prepareFn}(__import__("pathlib").Path(manage_py))
payload = {
    "settings_module": os.environ.get("DJANGO_SETTINGS_MODULE"),
    "sys_path_head": sys.path[0],
    "can_import_config": False,
}
try:
    importlib.import_module("config.settings")
    payload["can_import_config"] = True
except ModuleNotFoundError:
    pass
print(json.dumps(payload))
`;
  return JSON.parse(runPython(code, [managePy], env));
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
  const { managePy } = fixtureManagePyProject('config.settings.dev');
  const result = runManagePyPrepare('ensure_django_settings_module', managePy, {});
  assert.equal(result.settings_module, 'config.settings.dev');
});

test('ensure_django_settings_module leaves an existing env value unchanged', () => {
  const { managePy } = fixtureManagePyProject('config.settings.dev');
  const result = runManagePyPrepare('ensure_django_settings_module', managePy, {
    DJANGO_SETTINGS_MODULE: 'already.configured',
  });
  assert.equal(result.settings_module, 'already.configured');
});

test('ensure_manage_py_sys_path prepends the project root like python manage.py', () => {
  const { tmpDir, managePy } = fixtureManagePyProject('config.settings', {
    withConfigPackage: true,
  });
  const result = runManagePyPrepare('ensure_manage_py_sys_path', managePy, {});
  assert.equal(result.sys_path_head, tmpDir);
  assert.equal(result.can_import_config, true);
});

test('prepare_manage_py_environment sets settings and import path together', () => {
  const { tmpDir, managePy } = fixtureManagePyProject('config.settings', {
    withConfigPackage: true,
  });
  const result = runManagePyPrepare('prepare_manage_py_environment', managePy, {});
  assert.equal(result.settings_module, 'config.settings');
  assert.equal(result.sys_path_head, tmpDir);
  assert.equal(result.can_import_config, true);
});
