import { notifyParent } from './notifyParent.js';

/**
 * Handles URL changes and notifies parent if the path has changed
 * @param {Object} sdk - The SDK instance with currentPath property
 */
export function handleUrlChange(sdk) {
  if (typeof window === 'undefined') {
    return;
  }
  const newPath = window.location.pathname + window.location.search + window.location.hash;
  if (newPath !== sdk.currentPath) {
    sdk.currentPath = newPath;
    notifyParent();
  }
}
