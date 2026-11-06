/**
 * Ensures dev compose and .env.local.example stay aligned on REGION_CH_* keys.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const example = fs.readFileSync(path.join(__dirname, '.env.local.example'), 'utf8');
const compose = fs.readFileSync(path.join(__dirname, 'docker-compose.yml'), 'utf8');

test('dashboard compose uses REGION_CH_* from env example', () => {
  assert.match(example, /^DEV_REGION_CODE=ch$/m);
  for (const key of [
    'REGION_CH_IDENTITY_ORIGIN',
    'REGION_CH_STORAGE_ORIGIN',
    'REGION_CH_HOSTING_ORIGIN',
    'REGION_CH_EMAIL_ORIGIN',
    'REGION_CH_SAAS_ORIGIN',
    'REGION_CH_AI_ORIGIN',
  ]) {
    assert.match(example, new RegExp(`^${key}=`, 'm'), `missing ${key} in .env.local.example`);
    assert.match(
      compose,
      new RegExp(`${key}:\\s*\\$\\{${key}\\}`),
      `dashboard service missing ${key} in docker-compose.yml`,
    );
  }
  assert.doesNotMatch(example, /REGION_LOCAL_/);
  assert.match(example, /^GLOBAL_AGENT_SIGNING_KEY=/m);
  assert.match(compose, /GLOBAL_AGENT_SIGNING_KEY:\s*\$\{GLOBAL_AGENT_SIGNING_KEY\}/);
});
