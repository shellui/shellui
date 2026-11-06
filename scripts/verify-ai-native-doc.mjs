/**
 * Static checks for docs/features/ai-native.md (banned vague tokens, code layout).
 * Run: node scripts/verify-ai-native-doc.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docPath = path.join(__dirname, '..', 'docs', 'features', 'ai-native.md');

const text = fs.readFileSync(docPath, 'utf8');

const banned = [
  /\u2026/g,
  /\.\.\./g,
  /often shaped/i,
  /or equivalent/i,
  /high level/i,
  /REPLACE_WITH/i,
  /PASTE_FROM/i,
  /→/,
  /your-saas|your_saas|your-saas-host/i,
  /http:\/\/localhost:8001\/api\/v1\/companies\/<id>\/mcp/,
  /\bPR\s*#\d+/i,
];

const required = [
  'What this repo validates',
  'Live on your machine',
  'list_services',
  'urn:ietf:params:oauth:grant-type:token-exchange',
  '/oauth/mcp/token',
  'mcp-downstream-access-token',
  'api_v1_templates_render_preview',
  'api_v1_templates_list',
  'GLOBAL_AGENT_SIGNING_KEY',
  'SHELLUI_INSTANCE_ROLE',
  'McpAgentActivitySection.tsx',
  'projects create',
  'session_allow',
  'allow_session',
  'api_v1_companies_create',
  'api_v1_companies_retrieve',
  '"region":"ch"',
  'shellui.config.json',
  'requested_token_type',
  'urn:ietf:params:oauth:token-type:access_token',
  'include_saas',
  'REGION_CH_IDENTITY_ORIGIN',
  'storage_list_buckets',
  'POST /oauth/mcp/register',
  '/oauth/mcp/authorize',
  'http://localhost:8005/mcp',
  'http://localhost:8006/c/',
  'bucket_id',
  'allow_destructive_without_asking',
  'MCP_APPROVAL_SESSION_TTL_SECONDS',
  'handle_token_exchange',
  'api/v1/companies/',
  'GET /api/v1/mcp/approvals',
  'POST /api/v1/mcp/approvals/',
  "- '8001:8000'",
  'not implemented in saas yet',
];

const problems = [];
for (const pattern of banned) {
  if (pattern.test(text)) {
    problems.push(`matched forbidden pattern: ${pattern}`);
  }
}

for (const sub of required) {
  if (!text.includes(sub)) {
    problems.push(`missing required substring: ${sub}`);
  }
}

const MAX_NORMAL = 80;
const MAX_HTTP = 120;

const lines = text.split('\n');
let inFence = false;
let fenceStart = 0;
let lang = '';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.trim().startsWith('```')) {
    if (!inFence) {
      inFence = true;
      fenceStart = i;
      lang = line.trim().slice(3);
    } else {
      const bodyLines = lines.slice(fenceStart + 1, i);
      if (bodyLines.length > 25) {
        problems.push(
          `code block (${lang}) exceeds 25 lines: ${bodyLines.length} at line ${fenceStart + 1}`,
        );
      }
      const maxCode = lang === 'json' ? 96 : 80;
      for (let j = 0; j < bodyLines.length; j++) {
        if (bodyLines[j].length > maxCode) {
          problems.push(
            `code line >${maxCode} cols at ${fenceStart + 2 + j}: ${bodyLines[j].length} (${lang})`,
          );
        }
      }
      inFence = false;
    }
    continue;
  }
  if (inFence) continue;

  if (/^\[[^\]]+\]: https?:\/\//.test(line)) continue;

  const max = line.includes('http') ? MAX_HTTP : MAX_NORMAL;
  if (line.length > max) {
    problems.push(`prose/table line >${max} cols at ${i + 1}: ${line.length}`);
  }
}

if (problems.length) {
  console.error('verify-ai-native-doc failed:\n' + problems.join('\n'));
  process.exit(1);
}
console.log('verify-ai-native-doc: ok');
