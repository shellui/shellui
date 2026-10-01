import { postShellMessage, shellui, type ShellUIMessage } from '@shellui/sdk';

type ShellUIMessageType = ShellUIMessage['type'];

export type DeleteAccountResultStatus = 'deleted' | 'cancelled' | 'error';

export type UpdateProfileResult =
  | { status: 'saved'; name: string }
  | { status: 'error'; error?: string };

/** The delete confirmation dialog stays open until the user answers, so only give up after a long wait. */
const DELETE_RESULT_TIMEOUT_MS = 10 * 60_000;
const UPDATE_PROFILE_TIMEOUT_MS = 30_000;

const createRequestId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/**
 * Post an account request to the top-level shell (which owns the session) and resolve with
 * the payload of the matching result message, or `null` on timeout.
 */
function requestFromShell(
  requestType: ShellUIMessageType,
  resultType: ShellUIMessageType,
  payload: Record<string, unknown>,
  timeoutMs: number,
): Promise<Record<string, unknown> | null> {
  const id = createRequestId();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: Record<string, unknown> | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve(result);
    };
    const cleanup = shellui.addMessageListener(resultType, (message: ShellUIMessage) => {
      const result = message.payload as Record<string, unknown> | undefined;
      if (result?.id === id) finish(result);
    });
    const timer = setTimeout(() => finish(null), timeoutMs);
    postShellMessage({ type: requestType, payload: { ...payload, id } });
  });
}

/** Ask the shell to confirm and delete the signed-in account for the current company. */
export async function requestAccountDeletion(): Promise<DeleteAccountResultStatus> {
  const result = await requestFromShell(
    'SHELLUI_DELETE_ACCOUNT_REQUEST',
    'SHELLUI_DELETE_ACCOUNT_RESULT',
    {},
    DELETE_RESULT_TIMEOUT_MS,
  );
  const status = result?.status;
  return status === 'deleted' || status === 'cancelled' ? status : 'error';
}

/** Ask the shell to update the signed-in user's display name. */
export async function requestProfileUpdate(name: string): Promise<UpdateProfileResult> {
  const result = await requestFromShell(
    'SHELLUI_UPDATE_PROFILE_REQUEST',
    'SHELLUI_UPDATE_PROFILE_RESULT',
    { name },
    UPDATE_PROFILE_TIMEOUT_MS,
  );
  if (result?.status === 'saved' && typeof result.name === 'string') {
    return { status: 'saved', name: result.name };
  }
  return {
    status: 'error',
    error: typeof result?.error === 'string' ? result.error : undefined,
  };
}
