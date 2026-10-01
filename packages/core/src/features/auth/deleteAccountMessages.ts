import { postShellMessage, shellui, type ShellUIMessage } from '@shellui/sdk';

export type DeleteAccountResultStatus = 'deleted' | 'cancelled' | 'error';

/** The confirmation dialog stays open until the user answers, so only give up after a long wait. */
const RESULT_TIMEOUT_MS = 10 * 60_000;

const createRequestId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/**
 * Ask the top-level shell to confirm and delete the signed-in account for the current
 * company. The shell owns the session and shows the confirmation dialog.
 */
export function requestAccountDeletion(): Promise<DeleteAccountResultStatus> {
  const id = createRequestId();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (status: DeleteAccountResultStatus) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve(status);
    };
    const cleanup = shellui.addMessageListener(
      'SHELLUI_DELETE_ACCOUNT_RESULT',
      (message: ShellUIMessage) => {
        const payload = message.payload as { id?: unknown; status?: unknown } | undefined;
        if (payload?.id !== id) return;
        const status = payload.status;
        finish(status === 'deleted' || status === 'cancelled' ? status : 'error');
      },
    );
    const timer = setTimeout(() => finish('error'), RESULT_TIMEOUT_MS);
    postShellMessage({ type: 'SHELLUI_DELETE_ACCOUNT_REQUEST', payload: { id } });
  });
}
