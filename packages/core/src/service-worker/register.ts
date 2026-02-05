import { Workbox } from 'workbox-window';
import { shellui, getLogger } from '@shellui/sdk';

const logger = getLogger('shellcore');

let wb: Workbox | null = null;
let updateAvailable = false;
let waitingServiceWorker: ServiceWorker | null = null;
let registrationPromise: Promise<void> | null = null;
let statusListeners: Array<(status: { registered: boolean; updateAvailable: boolean }) => void> = [];
let isInitialRegistration = false; // Track if this is the first registration (no reload needed)
let eventListenersAdded = false; // Track if event listeners have been added to prevent duplicates
let toastShownForServiceWorkerId: string | null = null; // Track which service worker we've shown toast for (simple single source of truth)
let isIntentionalUpdate = false; // Track if we're performing an intentional update (user clicked Install Now)

// Store event handler references so we can remove them if needed
type EventHandler = (event?: any) => void;
let waitingHandler: EventHandler | null = null;
let activatedHandler: EventHandler | null = null;
let controllingHandler: EventHandler | null = null;
let registeredHandler: EventHandler | null = null;
let redundantHandler: EventHandler | null = null;
let serviceWorkerErrorHandler: EventHandler | null = null;
let messageErrorHandler: EventHandler | null = null;

/** Global set by host or by us from config so Tauri can be forced (e.g. when __TAURI__ is not yet injected in dev). */
declare global {
  interface Window {
    __SHELLUI_TAURI__?: boolean;
  }
}

function hasTauriOnWindow(w: Window | null): boolean {
  if (!w) return false;
  const o = w as Window & { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown; __SHELLUI_TAURI__?: boolean };
  if (o.__SHELLUI_TAURI__ === true) return true;
  return !!(o.__TAURI__ ?? o.__TAURI_INTERNALS__);
}

/** True when the app is running inside Tauri (desktop). Service worker is disabled there; a different caching system is used. */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  if (hasTauriOnWindow(window)) return true;
  try {
    if (window !== window.top && hasTauriOnWindow(window.top)) return true;
    if (window.parent && window.parent !== window && hasTauriOnWindow(window.parent)) return true;
  } catch {
    // Cross-origin: can't access top/parent
  }
  return false;
}

// Cache for service worker file existence check to avoid duplicate fetches
let swFileExistsCache: Promise<boolean> | null = null;
let swFileExistsCacheTime: number = 0;
const SW_FILE_EXISTS_CACHE_TTL = 5000; // Cache for 5 seconds

// Notify all listeners of status changes
async function notifyStatusListeners() {
  const registered = await isServiceWorkerRegistered();
  const status = {
    registered,
    updateAvailable,
  };
  statusListeners.forEach(listener => listener(status));
}

export interface ServiceWorkerRegistrationOptions {
  enabled: boolean;
  onUpdateAvailable?: () => void;
}

/**
 * Disable caching automatically when errors occur
 * This helps prevent hard-to-debug issues
 */
async function disableCachingAutomatically(reason: string): Promise<void> {
  logger.error(`Auto-disabling caching due to error: ${reason}`);
  
  try {
    // Unregister service worker first
    await unregisterServiceWorker();
    
    // Disable service worker in settings
    // We need to access settings through localStorage since we're in a module
    if (typeof window !== 'undefined') {
      const STORAGE_KEY = 'shellui:settings';
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const settings = JSON.parse(stored);
          // Only update if service worker is currently enabled to avoid unnecessary updates
          if (settings.serviceWorker?.enabled !== false) {
            settings.serviceWorker = { enabled: false };
            // Migrate legacy key so old cached shape is updated
            if (settings.caching !== undefined) {
              delete settings.caching;
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
            
            // Notify the app to reload settings via message system
            shellui.sendMessageToParent({
              type: 'SHELLUI_SETTINGS_UPDATED',
              payload: { settings }
            });
            
            // Also dispatch event for local listeners
            window.dispatchEvent(new CustomEvent('shellui:settings-updated', { 
              detail: { settings } 
            }));
            
            // Show a toast notification
            shellui.toast({
              title: 'Service Worker Disabled',
              description: `The service worker has been automatically disabled due to an error: ${reason}`,
              type: 'error',
              duration: 10000,
            });
          }
        } else {
          // No settings stored, create default with service worker disabled
          const defaultSettings = {
            serviceWorker: { enabled: false }
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultSettings));
          
          shellui.toast({
            title: 'Service Worker Disabled',
            description: `The service worker has been automatically disabled due to an error: ${reason}`,
            type: 'error',
            duration: 10000,
          });
        }
      } catch (error) {
        logger.error('Failed to disable service worker in settings:', { error });
        // Still show toast even if settings update fails
        shellui.toast({
          title: 'Service Worker Error',
          description: `Service worker error: ${reason}. Please disable it manually in settings.`,
          type: 'error',
          duration: 10000,
        });
      }
    }
  } catch (error) {
    logger.error('Failed to disable caching automatically:', error);
  }
}

/**
 * Check if service worker file exists
 * Uses caching to prevent duplicate fetches when called concurrently
 */
export async function serviceWorkerFileExists(): Promise<boolean> {
  const now = Date.now();
  
  // Return cached promise if it's still valid and in progress
  if (swFileExistsCache && (now - swFileExistsCacheTime) < SW_FILE_EXISTS_CACHE_TTL) {
    return swFileExistsCache;
  }
  
  // Create a new fetch promise and cache it
  swFileExistsCache = (async () => {
    try {
      // Use a timestamp to prevent caching
      const response = await fetch(`/sw.js?t=${Date.now()}`, { 
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      // Handle 500 errors - server error, disable caching
      if (response.status >= 500) {
        await disableCachingAutomatically(`Server error (${response.status}) when fetching service worker`);
        return false;
      }
      
      // If not ok or 404, file doesn't exist
      if (!response.ok || response.status === 404) {
        return false;
      }
      
      // Check content type - should be JavaScript
      const contentType = response.headers.get('content-type') || '';
      const isJavaScript = contentType.includes('javascript') || 
                           contentType.includes('application/javascript') || 
                           contentType.includes('text/javascript');
      
      // If content type is HTML, it's likely Vite's dev server returning index.html
      // which means the file doesn't exist
      if (contentType.includes('text/html')) {
        return false;
      }
      
      // Try to read a bit of the content to verify it's actually a service worker
      const text = await response.text();
      // Service worker files typically start with imports or have workbox/precache references
      const looksLikeServiceWorker = text.includes('workbox') || 
                                     text.includes('precache') || 
                                     text.includes('serviceWorker') ||
                                     text.includes('self.addEventListener');
      
      // If we got a response but it doesn't look like a service worker, disable caching
      if (!isJavaScript && !looksLikeServiceWorker) {
        await disableCachingAutomatically('Service worker file appears to be invalid or corrupted');
        return false;
      }
      
      return isJavaScript || looksLikeServiceWorker;
    } catch (error) {
      // Network errors - disable caching if it's a critical error
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        // Don't disable on network errors - might be offline
        return false;
      }
      // Other errors - disable caching
      await disableCachingAutomatically(`Network error: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  })();
  
  swFileExistsCacheTime = now;
  return swFileExistsCache;
}

/**
 * Register the service worker and handle updates
 */
export async function registerServiceWorker(
  options: ServiceWorkerRegistrationOptions = { enabled: true }
): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  if (isTauri()) {
    await unregisterServiceWorker();
    wb = null;
    return;
  }

  if (!options.enabled) {
    // If disabled, unregister existing service worker
    await unregisterServiceWorker();
    wb = null;
    return;
  }

  // Check if service worker file exists (works in both dev and production)
  const swExists = await serviceWorkerFileExists();
  if (!swExists) {
    // In dev mode, the service worker might not be ready yet, try again after a short delay
    // Only retry once to avoid infinite loops
    if (!registrationPromise) {
      setTimeout(async () => {
        const retryExists = await serviceWorkerFileExists();
        if (retryExists && !registrationPromise) {
          // Retry registration if file becomes available
          registerServiceWorker(options);
        } else if (!retryExists) {
          logger.warn('Service worker file not found. Service workers may not be available.');
        }
      }, 1000);
    }
    return;
  }

  // If already registering, wait for that to complete
  if (registrationPromise) {
    return registrationPromise;
  }

  registrationPromise = (async () => {
    try {
      // Check if service worker is already registered
      const existingRegistration = await navigator.serviceWorker.getRegistration();
      if (existingRegistration && wb) {
        // Already registered, just update
        isInitialRegistration = false; // This is an update check
        wb.update();
        return;
      }

      // Check if there's already a service worker controlling the page
      // If not, this is an initial registration (don't reload)
      isInitialRegistration = !navigator.serviceWorker.controller;

      // Register the service worker
      // Only create new Workbox instance if one doesn't exist
      const isNewWorkbox = !wb;
      if (!wb) {
        // Use updateViaCache: 'none' to ensure service worker file changes are always detected
        // This bypasses the browser cache when checking for updates to sw.js/sw-dev.js
        wb = new Workbox('/sw.js', { 
          type: 'classic',
          updateViaCache: 'none' // Always check network for service worker updates
        });
      }

      // Remove old listeners if they exist (handles React Strict Mode double-mounting)
      // Always remove listeners if wb exists and we have handler references, regardless of flag
      // This ensures we clean up properly even if the flag was reset
      if (wb) {
        if (waitingHandler) {
          wb.removeEventListener('waiting', waitingHandler);
          waitingHandler = null;
        }
        if (activatedHandler) {
          wb.removeEventListener('activated', activatedHandler);
          activatedHandler = null;
        }
        if (controllingHandler) {
          wb.removeEventListener('controlling', controllingHandler);
          controllingHandler = null;
        }
        if (registeredHandler) {
          wb.removeEventListener('registered', registeredHandler);
          registeredHandler = null;
        }
        if (redundantHandler) {
          wb.removeEventListener('redundant', redundantHandler);
          redundantHandler = null;
        }
        if (serviceWorkerErrorHandler) {
          navigator.serviceWorker.removeEventListener('error', serviceWorkerErrorHandler);
          serviceWorkerErrorHandler = null;
        }
        if (messageErrorHandler) {
          navigator.serviceWorker.removeEventListener('messageerror', messageErrorHandler);
          messageErrorHandler = null;
        }
        // Reset flag so we can add listeners again
        eventListenersAdded = false;
      }

      // Only add event listeners once (when creating a new Workbox instance or if they were removed)
      if (isNewWorkbox && !eventListenersAdded) {
        // Set flag IMMEDIATELY to prevent duplicate listener registration
        eventListenersAdded = true;

    // Handle service worker updates
    waitingHandler = async () => {
      try {
        // Get the waiting service worker
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration || !registration.waiting) {
          return;
        }
        
        const currentWaitingSW = registration.waiting;
        const currentWaitingSWId = currentWaitingSW.scriptURL;
        
        // SIMPLE CHECK: If we've already shown toast for this service worker, don't show again
        if (toastShownForServiceWorkerId === currentWaitingSWId) {
          return;
        }
        
        // Mark that we've shown toast for this service worker IMMEDIATELY
        // This prevents duplicate toasts even if the event fires multiple times
        toastShownForServiceWorkerId = currentWaitingSWId;
        
        // Update state
        updateAvailable = true;
        waitingServiceWorker = currentWaitingSW;
        notifyStatusListeners();
        
        // Show toast notification about update
        if (options.onUpdateAvailable) {
          options.onUpdateAvailable();
        } else {
          // Default behavior: show toast
          shellui.toast({
            title: 'New version available',
            description: 'A new version of the app is available. Install now or later?',
            type: 'info',
            duration: 0, // Don't auto-dismiss
            position: 'bottom-left',
            action: {
              label: 'Install Now',
              onClick: () => {
                logger.info('Install Now clicked, updating service worker...');
                updateServiceWorker().catch(error => {
                  logger.error('Failed to update service worker:', error);
                });
              },
            },
            cancel: {
              label: 'Later',
              onClick: () => {
                // User chose to install later, toast will be dismissed
              },
            },
          });
        }
      } catch (error) {
        logger.error('Error in waiting handler:', error);
        // On error, reset the flag so we can try again for this service worker
        toastShownForServiceWorkerId = null;
      }
    };
    wb.addEventListener('waiting', waitingHandler);

    // Handle service worker activated
    activatedHandler = (event: any) => {
      notifyStatusListeners();
      // Reset flags when service worker is activated (update installed or new registration)
      updateAvailable = false;
      waitingServiceWorker = null;
      toastShownForServiceWorkerId = null; // Reset so we can show toast for the next update
      
      // Clear intentional update flag after activation (update is complete)
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('shellui:service-worker:intentional-update');
      }
      
      // Only reload if this is an update (not initial registration)
      if (event.isUpdate && !isInitialRegistration) {
        // New service worker activated via update, reload the page
        window.location.reload();
      }
      // Reset flag after activation
      isInitialRegistration = false;
    };
    wb.addEventListener('activated', activatedHandler);

    // Handle service worker controlling
    controllingHandler = () => {
      notifyStatusListeners();
      // Only reload if this is an update scenario (not initial registration)
      // The controlling event fires when a service worker takes control
      // We only want to reload if it's taking control due to an update
      if (!isInitialRegistration && updateAvailable) {
        // Service worker took control after update, reload the page
        window.location.reload();
      }
      // Reset flag after controlling
      isInitialRegistration = false;
    };
    wb.addEventListener('controlling', controllingHandler);

    // Handle service worker registered
    registeredHandler = () => {
      notifyStatusListeners();
    };
    wb.addEventListener('registered', registeredHandler);

    // Handle service worker errors - disable caching on critical errors
    // Note: 'redundant' event fires when a service worker is replaced, which is NORMAL during updates
    // Only disable caching if this happens unexpectedly (not during an intentional update)
    redundantHandler = (event: any) => {
      logger.info('Service worker became redundant:', event);
      
      // Check if this is an intentional update (check both in-memory flag and sessionStorage)
      // sessionStorage survives page reloads, so it works even after the app refreshes
      const isIntentionalUpdatePersisted = typeof window !== 'undefined' && 
        sessionStorage.getItem('shellui:service-worker:intentional-update') === 'true';
      const isUpdateFlow = isIntentionalUpdate || isIntentionalUpdatePersisted;
      
      // Don't disable caching if this is part of a normal update flow
      if (!isUpdateFlow) {
        logger.warn('Service worker became redundant unexpectedly');
        disableCachingAutomatically('Service worker became redundant (likely due to an error)');
      } else {
        logger.info('Service worker became redundant as part of normal update - this is expected');
        // Clear the sessionStorage flag after handling
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('shellui:service-worker:intentional-update');
        }
        // Reset the flag after a short delay to allow for the update to complete
        setTimeout(() => {
          isIntentionalUpdate = false;
        }, 1000);
      }
    };
    wb.addEventListener('redundant', redundantHandler);

    // Handle external service worker errors
    // Only disable caching on critical errors, not during normal update operations
    serviceWorkerErrorHandler = (event: any) => {
      logger.error('Service worker error event:', event);
      
      // Check if this is an intentional update (check both in-memory flag and sessionStorage)
      const isIntentionalUpdatePersisted = typeof window !== 'undefined' && 
        sessionStorage.getItem('shellui:service-worker:intentional-update') === 'true';
      const isUpdateFlow = isIntentionalUpdate || isIntentionalUpdatePersisted;
      
      // Don't disable caching during intentional updates - some errors are expected during transitions
      if (!isUpdateFlow) {
        // Only disable on actual errors, not warnings or non-critical issues
        const errorMessage = event.message || 'Unknown error';
        // Some errors are expected during service worker updates, so be selective
        if (!errorMessage.includes('update') && !errorMessage.includes('activate')) {
          disableCachingAutomatically(`Service worker error: ${errorMessage}`);
        }
      }
    };
    navigator.serviceWorker.addEventListener('error', serviceWorkerErrorHandler);

    // Handle message errors from service worker
    messageErrorHandler = (event: any) => {
      logger.error('Service worker message error:', event);
      // Don't disable on message errors - they're usually not critical
    };
    navigator.serviceWorker.addEventListener('messageerror', messageErrorHandler);
      } // End of event listeners block

      // Register the service worker
      await wb.register();
      
      // Get the underlying registration to set updateViaCache
      // This ensures changes to sw.js/sw-dev.js are always detected (bypasses cache)
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        // Set updateViaCache to 'none' to ensure service worker file changes are always detected
        // This tells the browser to always check the network for sw.js/sw-dev.js updates
        // Note: This property is read-only in some browsers, but setting it helps where supported
        try {
          // Access the registration's update method to ensure cache-busting
          // The browser will check the service worker file with cache: 'reload' when update() is called
        } catch (e) {
          // Ignore if updateViaCache can't be set (some browsers don't support it)
        }
      }
      
      notifyStatusListeners();

      // Check for updates periodically (including service worker file changes)
      // This ensures changes to sw.js/sw-dev.js are detected
      const updateInterval = setInterval(() => {
        if (wb && options.enabled) {
          // wb.update() checks for updates to the service worker file itself
          // The browser will compare the byte-by-byte content of sw.js/sw-dev.js
          wb.update();
        }
      }, 60 * 60 * 1000); // Check every hour
      
      // Also check for updates when the page becomes visible (user returns to tab)
      // This helps detect service worker file changes more quickly
      let visibilityHandler: (() => void) | null = null;
      if (typeof document !== 'undefined') {
        visibilityHandler = () => {
          if (!document.hidden && wb && options.enabled) {
            wb.update();
          }
        };
        document.addEventListener('visibilitychange', visibilityHandler);
      }
      
      // Store interval and handler for cleanup (though cleanup is best-effort)
      // The interval will continue until page reload, which is acceptable
    } catch (error) {
      // Handle registration errors - disable caching
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Registration failed:', error);
      
      // Disable caching on critical errors
      if (
        errorMessage.includes('Failed to register') ||
        errorMessage.includes('script error') ||
        errorMessage.includes('SyntaxError') ||
        errorMessage.includes('TypeError') ||
        (error instanceof DOMException && error.name !== 'SecurityError')
      ) {
        await disableCachingAutomatically(`Registration failed: ${errorMessage}`);
      }
    } finally {
      registrationPromise = null;
    }
  })();

  return registrationPromise;
}

/**
 * Update the service worker immediately
 * This will reload the page when the update is installed
 */
export async function updateServiceWorker(): Promise<void> {
  if (!wb || !waitingServiceWorker) {
    return;
  }

  try {
    // CRITICAL: Ensure service worker setting is preserved and enabled before reload
    // This prevents the service worker from being disabled after refresh
    // The user explicitly clicked "Install Now", so we must keep the service worker enabled
    if (typeof window !== 'undefined') {
      const STORAGE_KEY = 'shellui:settings';
      const INTENTIONAL_UPDATE_KEY = 'shellui:service-worker:intentional-update';
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const settings = JSON.parse(stored);
          // Always ensure service worker is enabled when user clicks Install Now
          // This ensures it stays enabled after the page reloads
          settings.serviceWorker = { enabled: true };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
          
          // Mark that we're performing an intentional update (survives page reload)
          // This prevents the redundant event handler from disabling the service worker
          sessionStorage.setItem(INTENTIONAL_UPDATE_KEY, 'true');
          
          // Notify the app about the settings update (in case it's listening)
          shellui.sendMessageToParent({
            type: 'SHELLUI_SETTINGS_UPDATED',
            payload: { settings }
          });
        } else {
          // No settings stored, create default with service worker enabled
          const defaultSettings = {
            serviceWorker: { enabled: true }
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultSettings));
          // Mark intentional update
          sessionStorage.setItem(INTENTIONAL_UPDATE_KEY, 'true');
        }
      } catch (error) {
        logger.warn('Failed to preserve settings before update:', error);
        // Even if we fail to preserve settings, continue with the update
        // The app.tsx will default to enabled anyway
      }
    }
    
    // Mark that this is an intentional update initiated by the user
    isIntentionalUpdate = true;
    // Mark that this is an update (not initial registration)
    isInitialRegistration = false;
    
    // Set up reload handler before sending skip waiting
    const reloadApp = () => {
      // Use shellUI refresh message if available, otherwise fallback to window.location.reload
      const sent = shellui.sendMessageToParent({
        type: 'SHELLUI_REFRESH_PAGE',
        payload: {},
      });
      if (!sent) {
        window.location.reload();
      }
    };
    
    // Add one-time listener for controlling event
    const controllingHandler = () => {
      reloadApp();
      wb?.removeEventListener('controlling', controllingHandler);
      // Reset flag after reload is triggered
      setTimeout(() => {
        isIntentionalUpdate = false;
      }, 1000);
    };
    wb.addEventListener('controlling', controllingHandler);
    
    // Send skip waiting message to the waiting service worker
    waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
    
    // Fallback: if controlling event doesn't fire within 2 seconds, reload anyway
    setTimeout(() => {
      wb?.removeEventListener('controlling', controllingHandler);
      // Check if service worker is now controlling
      if (navigator.serviceWorker.controller) {
        reloadApp();
      }
      // Reset flag if fallback is used
      setTimeout(() => {
        isIntentionalUpdate = false;
      }, 1000);
    }, 2000);
  } catch (error) {
    logger.error('Failed to update service worker:', error);
    // Reset flag on error
    isIntentionalUpdate = false;
  }
}

/**
 * Unregister the service worker silently (no page reload)
 */
export async function unregisterServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    // Set flag to prevent any reloads during unregistration
    isInitialRegistration = true;
    
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.unregister();
      
      // Clear all caches silently
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
    }
    
    // Clean up workbox instance and remove all event listeners
    if (wb) {
      // Remove all event listeners before cleaning up
      if (waitingHandler) wb.removeEventListener('waiting', waitingHandler);
      if (activatedHandler) wb.removeEventListener('activated', activatedHandler);
      if (controllingHandler) wb.removeEventListener('controlling', controllingHandler);
      if (registeredHandler) wb.removeEventListener('registered', registeredHandler);
      if (redundantHandler) wb.removeEventListener('redundant', redundantHandler);
      if (serviceWorkerErrorHandler) {
        navigator.serviceWorker.removeEventListener('error', serviceWorkerErrorHandler);
      }
      if (messageErrorHandler) {
        navigator.serviceWorker.removeEventListener('messageerror', messageErrorHandler);
      }
      // Clear handler references
      waitingHandler = null;
      activatedHandler = null;
      controllingHandler = null;
      registeredHandler = null;
      redundantHandler = null;
      serviceWorkerErrorHandler = null;
      messageErrorHandler = null;
      // Remove workbox instance
      wb = null;
    }
    
    updateAvailable = false;
    waitingServiceWorker = null;
    isInitialRegistration = false;
    toastShownForServiceWorkerId = null; // Reset toast flag on unregister
    eventListenersAdded = false; // Reset event listeners flag on unregister
    isIntentionalUpdate = false; // Reset intentional update flag on unregister
    notifyStatusListeners();
  } catch (error) {
    logger.error('Failed to unregister service worker:', error);
    isInitialRegistration = false;
  }
}

/**
 * Check if service worker is registered and active
 */
export async function isServiceWorkerRegistered(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }
  if (isTauri()) {
    return false;
  }

  // First check if service worker file exists (only in production)
  const swExists = await serviceWorkerFileExists();
  if (!swExists) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      return false;
    }
    
    // Check if service worker is active (either controlling or installed)
    // A service worker can be registered but not yet active
    if (registration.active) {
      return true;
    }
    
    // Also check if there's a waiting or installing service worker
    // This means registration is in progress or update is available
    if (registration.waiting || registration.installing) {
      return true;
    }
    
    // If navigator.serviceWorker.controller exists, the SW is controlling the page
    if (navigator.serviceWorker.controller) {
      return true;
    }
    
    return false;
  } catch (error) {
    // Silently return false if there's an error checking registration
    return false;
  }
}

/**
 * Get service worker status
 */
export async function getServiceWorkerStatus(): Promise<{
  registered: boolean;
  updateAvailable: boolean;
}> {
  const registered = await isServiceWorkerRegistered();
  return {
    registered,
    updateAvailable,
  };
}

/**
 * Manually trigger a check for service worker updates (browser only).
 * Resolves when the check is complete. Listen to addStatusListener for updateAvailable changes.
 */
export async function checkForServiceWorkerUpdate(): Promise<void> {
  if (isTauri() || !wb) return;
  await wb.update();
}

/**
 * Add a listener for service worker status changes
 */
export function addStatusListener(listener: (status: { registered: boolean; updateAvailable: boolean }) => void): () => void {
  statusListeners.push(listener);
  // Don't call immediately - let the component do the initial check to avoid duplicate fetches
  
  // Return unsubscribe function
  return () => {
    statusListeners = statusListeners.filter(l => l !== listener);
  };
}
