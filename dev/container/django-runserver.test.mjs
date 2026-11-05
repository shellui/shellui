import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const shimPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'django-runserver.py');

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
  const result = spawnSync('python3', ['-c', code, argsJson], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'python subprocess failed');
  return JSON.parse(result.stdout.trim());
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
