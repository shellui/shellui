/* eslint-disable no-console */
/**
 * Logger utility with namespace support
 * Reads logging configuration from localStorage settings
 */

import { Roarr as roarrLogger, ROARR } from 'roarr';
import type { LoggerInstance } from '../types.js';

const STORAGE_KEY = 'shellui:settings';
const DEFAULT_NAMESPACES: Record<string, boolean> = {
  shellsdk: false,
  shellcore: false,
};

interface LoggingSettings {
  developerFeatures: { enabled: boolean };
  logging: { namespaces: Record<string, boolean> };
}

function getSettings(): LoggingSettings {
  if (typeof window === 'undefined') {
    return {
      developerFeatures: { enabled: false },
      logging: { namespaces: DEFAULT_NAMESPACES },
    };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<LoggingSettings>;
      return {
        developerFeatures: parsed.developerFeatures ?? { enabled: false },
        logging: {
          namespaces: parsed.logging?.namespaces ?? DEFAULT_NAMESPACES,
        },
      };
    }
  } catch {
    // Silently fail - use defaults
  }

  return {
    developerFeatures: { enabled: false },
    logging: { namespaces: DEFAULT_NAMESPACES },
  };
}

function isNamespaceEnabled(namespace: string): boolean {
  const settings = getSettings();

  if (!settings.developerFeatures?.enabled) {
    return false;
  }

  return settings.logging?.namespaces?.[namespace] === true;
}

const NAMESPACE_COLORS: Record<string, { bg: string; text: string; name: string }> = {
  shellsdk: {
    bg: '#3b82f6',
    text: '#ffffff',
    name: 'ShellSDK',
  },
  shellcore: {
    bg: '#10b981',
    text: '#ffffff',
    name: 'ShellCore',
  },
};

function getNamespaceStyles(namespace: string): Record<string, string> {
  const colors = NAMESPACE_COLORS[namespace] ?? {
    bg: '#6b7280',
    text: '#ffffff',
    name: namespace,
  };
  return {
    background: colors.bg,
    color: colors.text,
    padding: '2px 8px',
    borderRadius: '4px',
    fontWeight: '600',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };
}

function formatStyles(styles: Record<string, string>): string {
  return Object.entries(styles)
    .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
    .join('; ');
}

let writerInitialized = false;

function setupRoarrWriter(): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (writerInitialized) {
    return;
  }

  ROARR.write = (message: string) => {
    try {
      const logData = JSON.parse(message) as {
        context?: {
          namespace?: string;
          logLevel?: number;
          message?: string;
          [key: string]: unknown;
        };
        logLevel?: number;
      };
      const namespace = logData.context?.namespace;

      if (namespace && !isNamespaceEnabled(namespace as string)) {
        return;
      }

      const logLevel = logData.context?.logLevel ?? logData.logLevel ?? 0;
      const logMethod = logLevel >= 50 ? 'error' : logLevel >= 40 ? 'warn' : 'log';
      const messageText = String(logData.context?.message ?? '');

      const contextWithoutNamespace = { ...logData.context };
      delete contextWithoutNamespace.namespace;
      delete contextWithoutNamespace.logLevel;
      delete contextWithoutNamespace.message;
      const hasAdditionalContext = Object.keys(contextWithoutNamespace).length > 0;

      if (namespace) {
        const styles = getNamespaceStyles(namespace as string);
        const namespaceBadge = `[${NAMESPACE_COLORS[namespace as string]?.name ?? namespace}]`;
        const styleString = formatStyles(styles);

        if (hasAdditionalContext) {
          console[logMethod](
            `%c${namespaceBadge}%c ${messageText}`,
            styleString,
            '',
            contextWithoutNamespace,
          );
        } else {
          console[logMethod](`%c${namespaceBadge}%c ${messageText}`, styleString, '');
        }
      } else {
        if (hasAdditionalContext) {
          console[logMethod](messageText, contextWithoutNamespace);
        } else {
          console[logMethod](messageText);
        }
      }
    } catch {
      console.log(message);
    }
  };

  writerInitialized = true;
}

setupRoarrWriter();

export function getLogger(namespace: string): LoggerInstance {
  const logger = roarrLogger.child({ namespace });

  return {
    log: (message: string, context: Record<string, unknown> = {}) => {
      if (isNamespaceEnabled(namespace)) {
        (logger as unknown as (context: Record<string, unknown>) => void)({ ...context, message });
      }
    },
    info: (message: string, context: Record<string, unknown> = {}) => {
      if (isNamespaceEnabled(namespace)) {
        (logger as unknown as (context: Record<string, unknown>) => void)({
          ...context,
          message,
          logLevel: 30,
        });
      }
    },
    warn: (message: string, context: Record<string, unknown> = {}) => {
      if (isNamespaceEnabled(namespace)) {
        (logger as unknown as (context: Record<string, unknown>) => void)({
          ...context,
          message,
          logLevel: 40,
        });
      }
    },
    error: (message: string, context: Record<string, unknown> = {}) => {
      if (isNamespaceEnabled(namespace)) {
        (logger as unknown as (context: Record<string, unknown>) => void)({
          ...context,
          message,
          logLevel: 50,
        });
      }
    },
    debug: (message: string, context: Record<string, unknown> = {}) => {
      if (isNamespaceEnabled(namespace)) {
        (logger as unknown as (context: Record<string, unknown>) => void)({
          ...context,
          message,
          logLevel: 20,
        });
      }
    },
  };
}
