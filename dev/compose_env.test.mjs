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
  assert.match(example, /^GLOBAL_AGENT_KEY_ID=/m);
  assert.match(example, /^DEV_PUBLIC_HOST=/m);
  assert.match(example, /^PUBLIC_IDENTITY_GLOBAL_URL=http:\/\/\$\{DEV_PUBLIC_HOST\}:8007$/m);
  assert.match(example, /^IDENTITY_GLOBAL_JWT_AUDIENCE=shellui_global$/m);
  assert.match(example, /^GLOBAL_AGENT_ISSUER_URL=\$\{PUBLIC_SAAS_URL\}$/m);
  assert.match(example, /^GLOBAL_AGENT_JWKS=/m);
  assert.match(example, /^SHELLUI_INSTANCE_ROLE=region$/m);
  assert.match(compose, /GLOBAL_AGENT_SIGNING_KEY:\s*\$\{GLOBAL_AGENT_SIGNING_KEY\}/);
  assert.match(compose, /GLOBAL_AGENT_KEY_ID:\s*\$\{GLOBAL_AGENT_KEY_ID\}/);
  assert.match(compose, /GLOBAL_AGENT_ISSUER_URL:\s*\$\{PUBLIC_SAAS_URL\}/);
  assert.match(compose, /GLOBAL_AGENT_JWKS:\s*\$\{GLOBAL_AGENT_JWKS\}/);
  assert.match(compose, /GLOBAL_ISSUER_URL:\s*\$\{PUBLIC_SAAS_URL\}/);
  assert.match(compose, /GLOBAL_ISSUER_URL:\s*\$\{PUBLIC_IDENTITY_GLOBAL_URL\}/);
  assert.doesNotMatch(compose, /GLOBAL_AGENT_ISSUER:/);
  assert.match(compose, /SHELLUI_INSTANCE_ROLE:\s*global/);
  assert.match(compose, /'8007:8000'/);
  assert.match(compose, /IDENTITY_SERVICE_URL:\s*\$\{PUBLIC_IDENTITY_GLOBAL_URL\}/);
});
