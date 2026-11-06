import type { McpActivityErrorCode } from './personalAgentsApi';

/**
 * i18n paths under `settings` for each allowlisted identity `error_code`.
 * Keys must cover every `McpActivityErrorCode` (fixed allowlist, not free text).
 */
export const MCP_ACTIVITY_ERROR_CODE_I18N_KEYS: Record<McpActivityErrorCode, string> = {
  bad_request: 'mcpAgents.activity.detail.errorCode.badRequest',
  unauthorized: 'mcpAgents.activity.detail.errorCode.unauthorized',
  forbidden: 'mcpAgents.activity.detail.errorCode.forbidden',
  not_found: 'mcpAgents.activity.detail.errorCode.notFound',
  conflict: 'mcpAgents.activity.detail.errorCode.conflict',
  rate_limited: 'mcpAgents.activity.detail.errorCode.rateLimited',
  denied: 'mcpAgents.activity.detail.errorCode.denied',
  expired: 'mcpAgents.activity.detail.errorCode.expired',
  timeout: 'mcpAgents.activity.detail.errorCode.timeout',
  upstream_error: 'mcpAgents.activity.detail.errorCode.upstreamError',
  internal_error: 'mcpAgents.activity.detail.errorCode.internalError',
  out_of_sync: 'mcpAgents.activity.detail.errorCode.outOfSync',
  identity_unreachable: 'mcpAgents.activity.detail.errorCode.identityUnreachable',
  identity_unavailable: 'mcpAgents.activity.detail.errorCode.identityUnavailable',
  identity_invalid: 'mcpAgents.activity.detail.errorCode.identityInvalid',
  invalid_grant: 'mcpAgents.activity.detail.errorCode.invalidGrant',
  permission_changed: 'mcpAgents.activity.detail.errorCode.permissionChanged',
  request_expired: 'mcpAgents.activity.detail.errorCode.requestExpired',
  agent_revoked: 'mcpAgents.activity.detail.errorCode.agentRevoked',
  downstream_error: 'mcpAgents.activity.detail.errorCode.downstreamError',
  server_error: 'mcpAgents.activity.detail.errorCode.serverError',
  unknown: 'mcpAgents.activity.detail.errorCode.unknown',
};
