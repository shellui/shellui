#!/usr/bin/env node
/**
 * Generate JSON Schema for ShellUIConfig from TypeScript types.
 * Run: pnpm --filter @shellui/core run generate:config-schema
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createGenerator } from 'ts-json-schema-generator';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const outPath = path.join(packageRoot, 'schemas', 'shellui.config.schema.json');

const config = {
  path: path.join(packageRoot, 'src/features/config/types.ts'),
  tsconfig: path.join(packageRoot, 'tsconfig.json'),
  type: 'ShellUIConfig',
  expose: 'export',
  jsDoc: 'extended',
  skipTypeCheck: true,
  topRef: true,
  additionalProperties: false,
};

const schema = createGenerator(config).createSchema(config.type);

schema.$schema = 'http://json-schema.org/draft-07/schema#';
schema.title = 'ShellUIConfig';
schema.description =
  'Shellui application configuration (shellui.config.json). Generated from ShellUIConfig TypeScript types.';

// Allow $schema in config files for editor tooling without failing validation.
if (schema.definitions?.ShellUIConfig) {
  const def = schema.definitions.ShellUIConfig;
  def.properties = def.properties || {};
  def.properties.$schema = {
    type: 'string',
    description: 'JSON Schema URL for editor autocomplete and validation.',
  };
} else if (schema.properties) {
  schema.properties.$schema = {
    type: 'string',
    description: 'JSON Schema URL for editor autocomplete and validation.',
  };
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(schema, null, 2)}\n`, 'utf8');
console.log(`Wrote ${outPath}`);
