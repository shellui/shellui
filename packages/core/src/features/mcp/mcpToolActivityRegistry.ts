/**
 * Known MCP tool names surfaced in Shellui tests and docs. Everything else is unknown until identity publishes a canonical list.
 */
const TOOL_LABELS: Record<string, string> = {
  storage_delete: 'Delete stored object',
  identity_list_users: 'List directory members',
  hosting_deploy: 'Deploy hosting',
  hosting_deployments_list: 'List deployments',
  projects_list: 'List projects',
  companies_list: 'List companies',
};

/**
 * Known result strings from identity activity rows. Unlisted values stay verbatim only when safe (handled by callers).
 */
const RESULT_LABELS: Record<string, string> = {
  ok: 'Completed',
  success: 'Completed',
  allowed: 'Allowed',
  denied: 'Denied',
  pending: 'Pending approval',
  pending_approval: 'Pending approval',
  awaiting_approval: 'Pending approval',
  failed: 'Failed',
  error: 'Failed',
};

export function humanizeMcpToolName(toolName: string): string | null {
  const key = toolName.trim();
  if (!key) return null;
  const direct = TOOL_LABELS[key];
  if (direct) return direct;
  const lower = key.toLowerCase();
  return TOOL_LABELS[lower] ?? null;
}

export function humanizeMcpActivityResult(result: string): string | null {
  const key = result.trim();
  if (!key) return null;
  const norm = key.toLowerCase().replace(/[\s-]+/g, '_');
  return RESULT_LABELS[key] ?? RESULT_LABELS[norm] ?? null;
}
