import i18n from 'i18next';
import { shellui } from '@shellui/sdk';
import { resolveRegisteredFrameSrc } from '../security/trustedFrames';
import { findThirdPartyAppForFrameSrc } from './installedAppRegistry';

/**
 * "Notes (third-party app)" for a message sent by an installed third-party frame, or null
 * for the shell and its own pages. Toasts and dialogs carry this, so an app cannot show a
 * notice that reads as if the shell wrote it.
 */
export function thirdPartySenderLabel(from: string[] | undefined): string | null {
  const src = resolveRegisteredFrameSrc(from, shellui.frameRegistry);
  if (!src) return null;
  const app = findThirdPartyAppForFrameSrc(src);
  if (!app) return null;
  return i18n.t('marketplace.thirdPartySender', {
    name: app.name,
    defaultValue: `${app.name} (third-party app)`,
  });
}

/** Put the sender in front of a title so it cannot be mistaken for a shell message. */
export function attributeTitle(title: string, label: string | null): string {
  if (!label) return title;
  return title ? `${label}: ${title}` : label;
}
