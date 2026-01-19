/**
 * Logger utility with namespace support
 * Reads logging configuration from localStorage settings
 */

import { Roarr as roarrLogger, ROARR } from 'roarr';

const STORAGE_KEY = 'shellui:settings';
const DEFAULT_NAMESPACES = {
  shellsdk: false,
  shellcore: false,
};

/**
 * Get all settings from localStorage
 * @returns {Object} Settings object with developerFeatures and logging
 */
function getSettings() {
  if (typeof window === 'undefined') {
    return {
      developerFeatures: { enabled: false },
      logging: { namespaces: DEFAULT_NAMESPACES }
    };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        developerFeatures: parsed.developerFeatures || { enabled: false },
        logging: {
          namespaces: parsed.logging?.namespaces || DEFAULT_NAMESPACES
        }
      };
    }
  } catch (error) {
    // Silently fail - use defaults
  }

  return {
    developerFeatures: { enabled: false },
    logging: { namespaces: DEFAULT_NAMESPACES }
  };
}

/**
 * Check if a namespace is enabled for logging
 * Also checks if developer mode is enabled
 * @param {string} namespace - The namespace to check (e.g., 'shellsdk', 'shellcore')
 * @returns {boolean} True if the namespace is enabled AND developer mode is enabled
 */
function isNamespaceEnabled(namespace) {
  const settings = getSettings();

  // First check if developer features are enabled
  if (!settings.developerFeatures?.enabled) {
    return false;
  }

  // Then check if the specific namespace is enabled
  return settings.logging?.namespaces?.[namespace] === true;
}

/**
 * Color schemes for different namespaces
 */
const NAMESPACE_COLORS = {
  shellsdk: {
    bg: '#3b82f6', // blue-500
    text: '#ffffff',
    name: 'ShellSDK'
  },
  shellcore: {
    bg: '#10b981', // emerald-500
    text: '#ffffff',
    name: 'ShellCore'
  }
};

/**
 * Get color styles for a namespace badge
 */
function getNamespaceStyles(namespace) {
  const colors = NAMESPACE_COLORS[namespace] || { bg: '#6b7280', text: '#ffffff', name: namespace };
  return {
    background: colors.bg,
    color: colors.text,
    padding: '2px 8px',
    borderRadius: '4px',
    fontWeight: '600',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  };
}

/**
 * Format CSS styles for console
 */
function formatStyles(styles) {
  return Object.entries(styles)
    .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
    .join('; ');
}

/**
 * Setup ROARR writer to handle log messages
 * This intercepts all roarr log messages and filters by namespace
 */
function setupRoarrWriter() {
  if (typeof window === 'undefined') {
    return;
  }

  // Only setup once
  if (ROARR.write) {
    return;
  }

  ROARR.write = (message) => {
    try {
      const logData = JSON.parse(message);
      const namespace = logData.context?.namespace;

      // If namespace is specified, check if it's enabled
      if (namespace && !isNamespaceEnabled(namespace)) {
        return; // Skip logging if namespace is disabled
      }

      // Format and output the log
      const logLevel = logData.context?.logLevel || logData.logLevel || 0;
      const logMethod = logLevel >= 50 ? 'error' : logLevel >= 40 ? 'warn' : 'log';
      const messageText = logData.context.message || '';

      // Extract additional context (excluding namespace and logLevel)
      const contextWithoutNamespace = { ...logData.context };
      delete contextWithoutNamespace.namespace;
      delete contextWithoutNamespace.logLevel;
      delete contextWithoutNamespace.message;
      const hasAdditionalContext = Object.keys(contextWithoutNamespace).length > 0;

      if (namespace) {
        // Create styled namespace badge with background color
        const styles = getNamespaceStyles(namespace);
        const namespaceBadge = `[${NAMESPACE_COLORS[namespace]?.name || namespace}]`;
        const styleString = formatStyles(styles);

        // Output with colored namespace badge and plain message text
        // Use %c for the badge styling, then empty string to reset for the message
        if (hasAdditionalContext) {
          console[logMethod](`%c${namespaceBadge}%c ${messageText}`, styleString, '', contextWithoutNamespace);
        } else {
          console[logMethod](`%c${namespaceBadge}%c ${messageText}`, styleString, '');
        }
      } else {
        // No namespace, just output the message
        if (hasAdditionalContext) {
          console[logMethod](messageText, contextWithoutNamespace);
        } else {
          console[logMethod](messageText);
        }
      }
    } catch (error) {
      // Fallback to console.log if parsing fails
      console.log(message);
    }
  };
}

// Setup writer on module load
setupRoarrWriter();

/**
 * Get a logger instance for a namespace
 * This will check if the namespace is enabled before logging
 * @param {string} namespace - The namespace for this logger (e.g., 'shellsdk', 'shellcore')
 * @returns {Object} Logger instance with log methods
 */
export function getLogger(namespace) {
  const logger = roarrLogger.child({ namespace });

  return {
    log: (message, context = {}) => {
      if (isNamespaceEnabled(namespace)) {
        logger({ ...context, message });
      }
    },
    info: (message, context = {}) => {
      if (isNamespaceEnabled(namespace)) {
        logger({ ...context, message, logLevel: 30 });
      }
    },
    warn: (message, context = {}) => {
      if (isNamespaceEnabled(namespace)) {
        logger({ ...context, message, logLevel: 40 });
      }
    },
    error: (message, context = {}) => {
      if (isNamespaceEnabled(namespace)) {
        logger({ ...context, message, logLevel: 50 });
      }
    },
    debug: (message, context = {}) => {
      if (isNamespaceEnabled(namespace)) {
        logger({ ...context, message, logLevel: 20 });
      }
    },
  };
}
