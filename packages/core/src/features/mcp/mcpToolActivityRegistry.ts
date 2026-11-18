/**
 * Known MCP tool names from Shellui fixtures. Unknown tools fall back to a neutral technical label in the UI.
 */
const TOOL_LABELS: Record<string, string> = {
  storage_delete: 'Delete stored object',
  identity_list_users: 'List directory members',
  hosting_deploy: 'Deploy hosting',
  hosting_deployments_list: 'List deployments',
  projects_list: 'List projects',
  companies_list: 'List companies',
};

export function humanizeMcpToolName(toolName: string): string | null {
  const key = toolName.trim();
  if (!key) return null;
  const direct = TOOL_LABELS[key];
  if (direct) return direct;
  const lower = key.toLowerCase();
  return TOOL_LABELS[lower] ?? null;
}
