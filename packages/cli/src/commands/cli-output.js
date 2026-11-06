/**
 * @param {unknown} data
 */
export function printCliJson(data) {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

/**
 * @param {unknown} err
 */
export function cliErrorMessage(err) {
  return err instanceof Error ? err.message : String(err);
}
