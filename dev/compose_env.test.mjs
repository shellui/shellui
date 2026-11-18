/**
 * Ensures dev compose, .env.local.example, and Postgres init stay aligned.
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
const initScript = fs.readFileSync(path.join(__dirname, 'postgres/init-databases.sh'), 'utf8');
const startScript = fs.readFileSync(path.join(__dirname, 'start.sh'), 'utf8');

function composeServices(composeText) {
  const lines = composeText.split('\n');
  const servicesAt = lines.findIndex((line) => line === 'services:');
  assert.ok(servicesAt >= 0, 'services: section');
  const blocks = new Map();
  let name = null;
  let buf = [];
  for (let i = servicesAt + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^[a-z]/.test(line)) break;
    const heading = line.match(/^  ([a-z0-9-]+):\s*$/);
    if (heading) {
      if (name) blocks.set(name, buf.join('\n'));
      name = heading[1];
      buf = [];
      continue;
    }
    if (name) buf.push(line);
  }
  if (name) blocks.set(name, buf.join('\n'));
  return blocks;
}

function initDatabases(script) {
  const match = script.match(/^DATABASES=\(\n([\s\S]*?)\n\)/m);
  assert.ok(match, 'DATABASES array in init-databases.sh');
  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

function envDatabases(envExample) {
  const found = [];
  for (const line of envExample.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+_POSTGRES_DATABASE_URL)=\S+\/([a-z][a-z0-9_]*)\s*$/);
    if (match) found.push({ key: match[1], database: match[2] });
  }
  return found;
}

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

test('init list covers every *_POSTGRES_DATABASE_URL and Postgres backends wait for postgres-init', () => {
  const listed = initDatabases(initScript);
  const fromEnv = envDatabases(example);
  assert.ok(fromEnv.length > 0, 'expected *_POSTGRES_DATABASE_URL entries');
  assert.deepEqual(
    listed,
    [...new Set(fromEnv.map((entry) => entry.database))],
    'DATABASES must match *_POSTGRES_DATABASE_URL names, in example order',
  );
  for (const entry of fromEnv) {
    assert.ok(
      listed.includes(entry.database),
      `${entry.key} database ${entry.database} missing from init list`,
    );
  }

  assert.match(initScript, /NOT EXISTS/);
  assert.match(initScript, /\\gexec/);
  assert.doesNotMatch(initScript, /^\s*CREATE DATABASE /m);

  const services = composeServices(compose);
  const init = services.get('postgres-init');
  assert.ok(init, 'postgres-init service');
  assert.match(init, /image: postgres:17-alpine/);
  assert.match(init, /PGHOST: postgres/);
  assert.match(init, /\/init-databases\.sh:ro/);
  assert.match(init, /command: \['\/init-databases\.sh'\]/);
  assert.match(init, /postgres:\n\s+condition: service_healthy/);

  const postgres = services.get('postgres');
  assert.ok(postgres, 'postgres service');
  assert.match(
    postgres,
    /\.\/postgres\/init-databases\.sh:\/docker-entrypoint-initdb\.d\/01-init-databases\.sh:ro/,
  );

  const backends = [...services.entries()].filter(([, block]) =>
    block.includes('POSTGRES_DATABASE_URL:'),
  );
  assert.deepEqual(
    backends.map(([name]) => name),
    ['identity', 'identity-global', 'storage', 'hosting', 'email', 'email-worker', 'saas', 'ai'],
  );
  for (const [name, block] of backends) {
    assert.match(
      block,
      /postgres-init:\n\s+condition: service_completed_successfully/,
      `${name} must depend on postgres-init`,
    );
  }

  assert.match(
    startScript,
    /docker compose --env-file \.env\.local -f docker-compose\.yml rm -f -s postgres-init/,
  );
  assert.match(
    startScript,
    /exec docker compose --env-file \.env\.local -f docker-compose\.yml up --build "\$@"/,
  );
});
