export type StorageBridgeTarget = {
  storageUrl: string | null;
  accessToken: string | null;
};

/**
 * Pick the storage URL and token for one `SHELLUI_STORAGE_REQUEST`.
 *
 * A nested frame (the dashboard hosting regional admin, which hosts Files)
 * carries its own storage URL and regional session. Use those, even when the
 * URL is missing: falling back to the shell's storage would call another
 * region. Frames the shell hosts directly keep `storage.url` from
 * shellui.config and the shell session.
 */
export function resolveStorageBridgeTarget(
  nested: StorageBridgeTarget | null,
  shell: StorageBridgeTarget,
): StorageBridgeTarget {
  if (!nested) return shell;
  return {
    storageUrl: nested.storageUrl,
    accessToken: nested.accessToken,
  };
}
