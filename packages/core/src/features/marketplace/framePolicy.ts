import { resolveContentIframeSandbox } from '../../components/contentIframeSandbox';
import { isSafeIframeUrl } from '../../components/iframeUrlSafety';
import { isShellDevelopment } from '../security/urlAllowlist';
import { isLocalDevHost } from './icons';
import { originHasThirdPartyInstall } from './installedAppRegistry';

/**
 * Third-party frames never receive `allow-top-navigation`, `allow-popups`, `allow-modals`,
 * or a Permissions-Policy allowlist. `allow-same-origin` only keeps the app's own storage
 * working, and a frame can never share the shell's origin (installs on it are refused).
 * Cross-origin URLs must be HTTPS. `http://localhost` is available in development builds only.
 */
export const THIRD_PARTY_IFRAME_SANDBOX = 'allow-same-origin allow-scripts allow-forms';

export interface ContentFramePolicy {
  sandbox: string;
  referrerPolicy: 'no-referrer' | 'no-referrer-when-downgrade';
  allow?: '';
  permitted: boolean;
}

/**
 * A third-party frame renders only for an origin that was installed. This is the shell-side
 * frame-src: a navigation item or deep link cannot point an installed app's slot at another host.
 */
export function isAllowedThirdPartyFrameUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    if (!originHasThirdPartyInstall(parsed.origin)) return false;
    if (parsed.protocol === 'https:') return true;
    return parsed.protocol === 'http:' && isLocalDevHost(parsed.hostname) && isShellDevelopment();
  } catch {
    return false;
  }
}

export function resolveContentFramePolicy(
  iframeUrl: string,
  options: { thirdParty: boolean; shellOrigin?: string },
): ContentFramePolicy {
  if (!options.thirdParty) {
    const shell = options.shellOrigin ? shellLocation(options.shellOrigin) : undefined;
    return {
      sandbox: resolveContentIframeSandbox(iframeUrl, options.shellOrigin),
      referrerPolicy: 'no-referrer-when-downgrade',
      permitted: isSafeIframeUrl(iframeUrl, shell),
    };
  }

  return {
    sandbox: THIRD_PARTY_IFRAME_SANDBOX,
    referrerPolicy: 'no-referrer',
    allow: '',
    permitted: isAllowedThirdPartyFrameUrl(iframeUrl),
  };
}

function shellLocation(origin: string): { href: string; protocol: string; host: string } {
  const url = new URL(origin);
  return { href: url.href, protocol: url.protocol, host: url.host };
}
