/** Persist browser-catalog install records across reloads (shared by all apps in this origin). */

export const BROWSER_INSTALL_STORAGE_KEY = 'shellui:ai:browserInstalled';

export type BrowserInstallRecord = {
  /** Local model id without `webllm:` prefix. */
  id: string;
  installedAt: number;
};

function readStore(): BrowserInstallRecord[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(BROWSER_INSTALL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is BrowserInstallRecord =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as BrowserInstallRecord).id === 'string',
    );
  } catch {
    return [];
  }
}

function writeStore(records: BrowserInstallRecord[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(BROWSER_INSTALL_STORAGE_KEY, JSON.stringify(records));
}

export function listBrowserInstalledIds(): string[] {
  return readStore().map((record) => record.id);
}

export function isBrowserModelInstalled(modelId: string): boolean {
  const localId = modelId.replace(/^webllm:/, '');
  return listBrowserInstalledIds().includes(localId);
}

export function markBrowserModelInstalled(modelId: string): void {
  const localId = modelId.replace(/^webllm:/, '');
  const existing = readStore().filter((record) => record.id !== localId);
  existing.push({ id: localId, installedAt: Date.now() });
  writeStore(existing);
}

export function removeBrowserModelInstalled(modelId: string): void {
  const localId = modelId.replace(/^webllm:/, '');
  writeStore(readStore().filter((record) => record.id !== localId));
}

export function clearBrowserInstalledForTests(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(BROWSER_INSTALL_STORAGE_KEY);
}
