import { Settings } from '../SettingsContext'

/**
 * Sends settings update to parent window using postMessage
 * If in iframe, sends to parent (will be propagated by SDK's setupIframeMessageListener)
 * If at root level, logs the update directly without postMessage
 */
export function notifyParentSettingsUpdate(settings: Settings) {
  if (typeof window === 'undefined') {
    return
  }

  const message = {
    type: 'SHELLUI_SETTINGS_UPDATED',
    payload: {
      settings
    }
  }

  // If in iframe, send to parent (SDK's setupIframeMessageListener will propagate it)
  if (window.parent !== window) {
    window.parent.postMessage(message, '*')
  } else {
    // At root level, log directly (no postMessage needed)
    window.postMessage(message, '*')
  }
}
