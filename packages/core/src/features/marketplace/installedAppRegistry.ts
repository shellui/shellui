import type { InstalledAppRecord } from './overlay';

let records: InstalledAppRecord[] = [];

export function replaceInstalledAppRecords(next: readonly InstalledAppRecord[]): void {
  records = next.map((app) => ({ ...app, capabilities: [...app.capabilities] }));
}

export function getInstalledAppRecords(): readonly InstalledAppRecord[] {
  return records;
}

export function originHasThirdPartyInstall(origin: string): boolean {
  return records.some((app) => app.thirdParty && app.origin === origin);
}

export function frameMatchesInstalledApp(frameSrc: string, appUrl: string): boolean {
  try {
    const frame = new URL(frameSrc, globalThis.window?.location?.href);
    const app = new URL(appUrl, globalThis.window?.location?.href);
    if (frame.origin !== app.origin) return false;
    const appPath = app.pathname.replace(/\/+$/, '') || '/';
    const framePath = frame.pathname.replace(/\/+$/, '') || '/';
    if (appPath === '/') return true;
    return framePath === appPath || framePath.startsWith(`${appPath}/`);
  } catch {
    return false;
  }
}

export function isThirdPartyFrameSrc(frameSrc: string): boolean {
  return records.some((app) => app.thirdParty && frameMatchesInstalledApp(frameSrc, app.url));
}

export function clearInstalledAppRecords(): void {
  records = [];
}
