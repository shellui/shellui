import { resolveContentIframeSandbox } from '../../components/contentIframeSandbox';
import { isSafeIframeUrl } from '../../components/iframeUrlSafety';
import { isLocalDevHost } from './icons';

/**
 * Third-party frames never receive `allow-top-navigation` or a Permissions-Policy allowlist.
 * Cross-origin URLs must be HTTPS. `http://localhost` stays available for local development.
 */
export const THIRD_PARTY_IFRAME_SANDBOX =
  'allow-same-origin allow-scripts allow-forms allow-popups';

export interface ContentFramePolicy {
  sandbox: string;
  referrerPolicy: 'no-referrer' | 'no-referrer-when-downgrade';
  allow?: '';
  permitted: boolean;
}

export function isAllowedThirdPartyFrameUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:') return true;
    return parsed.protocol === 'http:' && isLocalDevHost(parsed.hostname);
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
