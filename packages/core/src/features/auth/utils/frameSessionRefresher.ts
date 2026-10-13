type FrameSessionRefresher = () => Promise<string | null>;

let refresher: FrameSessionRefresher | null = null;

/** AuthProvider registers the shell refresh used when an iframe asks for a session. */
export function registerFrameSessionRefresher(fn: FrameSessionRefresher): () => void {
  refresher = fn;
  return () => {
    if (refresher === fn) refresher = null;
  };
}

/**
 * Refresh when the shell token is due, then return the access token to hand off.
 * `undefined` means no refresher is registered and the caller should use its own copy.
 * `null` means the shell has no session.
 */
export async function refreshFrameAccessTokenIfNeeded(): Promise<string | null | undefined> {
  if (!refresher) return undefined;
  return refresher();
}
