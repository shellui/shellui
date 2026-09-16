import fs from 'fs';
import Ajv from 'ajv';
import pc from 'picocolors';
import { resolveConfigSchemaPath, stripSchemaKey } from './config-paths.js';

let cachedValidate = null;

/**
 * Load and compile the ShellUIConfig JSON Schema (cached).
 * @returns {import('ajv').ValidateFunction}
 */
export function getConfigValidator() {
  if (cachedValidate) return cachedValidate;
  const schemaPath = resolveConfigSchemaPath();
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv({
    allErrors: true,
    strict: false,
    allowUnionTypes: true,
  });
  cachedValidate = ajv.compile(schema);
  return cachedValidate;
}

/**
 * Format Ajv errors into actionable messages.
 * @param {import('ajv').ErrorObject[] | null | undefined} errors
 * @returns {string[]}
 */
export function formatConfigValidationErrors(errors) {
  if (!errors?.length) return ['Unknown validation error'];
  return errors.map((err) => {
    const path = err.instancePath || '/';
    const msg = err.message || 'is invalid';
    if (err.params?.additionalProperty) {
      return `${path}: must NOT have additional property '${err.params.additionalProperty}'`;
    }
    if (err.params?.allowedValues) {
      return `${path} ${msg}: ${err.params.allowedValues.join(', ')}`;
    }
    return `${path} ${msg}`;
  });
}

/**
 * Validate a config object against the JSON Schema.
 * Throws with a clear multi-line message on failure.
 * @param {unknown} config
 * @param {{ source?: string }} [options]
 */
export function validateConfig(config, options = {}) {
  const validate = getConfigValidator();
  const toValidate = stripSchemaKey(
    config && typeof config === 'object' && !Array.isArray(config)
      ? /** @type {Record<string, unknown>} */ (config)
      : {},
  );

  const valid = validate(toValidate);
  if (valid) return toValidate;

  const lines = formatConfigValidationErrors(validate.errors);
  const source = options.source ? ` (${options.source})` : '';
  const message =
    `Invalid Shellui configuration${source}:\n` +
    lines.map((line) => `  - ${line}`).join('\n') +
    `\nFix the configuration or run ${pc.bold('shellui config migrate')} / check the schema at @shellui/core/schemas/shellui.config.schema.json.`;

  const err = new Error(message);
  err.code = 'CONFIG_VALIDATION';
  err.validationErrors = lines;
  throw err;
}
