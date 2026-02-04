import { Workbox } from 'workbox-window';
import { shellui } from '@shellui/sdk';

let wb: Workbox | null = null;
let updateAvailable = false;
let waitingServiceWorker: ServiceWorker | null = null;
let registrationPromise: Promise<void> | null = null;
let statusListeners: Array<(status: { registered: boolean; updateAvailable: boolean }) => void> = [];

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
  console.error(`[Service Worker] Auto-disabling caching due to error: ${reason}`);
  
  try {
    // Unregister service worker first
    await unregisterServiceWorker();
    
    // Disable caching in settings
    // We need to access settings through localStorage since we're in a module
    if (typeof window !== 'undefined') {
      const STORAGE_KEY = 'shellui_settings';
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const settings = JSON.parse(stored);
          // Only update if caching is currently enabled to avoid unnecessary updates
          if (settings.caching?.enabled !== false) {
            settings.caching = { enabled: false };
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
              title: 'Caching Disabled',
              description: `Service worker caching has been automatically disabled due to an error: ${reason}`,
              type: 'error',
              duration: 10000,
            });
          }
        } else {
          // No settings stored, create default with caching disabled
          const defaultSettings = {
            caching: { enabled: false }
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultSettings));
          
          shellui.toast({
            title: 'Caching Disabled',
            description: `Service worker caching has been automatically disabled due to an error: ${reason}`,
            type: 'error',
            duration: 10000,
          });
        }
      } catch (error) {
        console.error('Failed to disable caching in settings:', error);
        // Still show toast even if settings update fails
        shellui.toast({
          title: 'Caching Error',
          description: `Service worker error: ${reason}. Please disable caching manually in settings.`,
          type: 'error',
          duration: 10000,
        });
      }
    }
  } catch (error) {
    console.error('Failed to disable caching automatically:', error);
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
          console.warn('Service worker file not found. Service workers may not be available.');
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
        wb.update();
        return;
      }

      // Register the service worker
      wb = new Workbox('/sw.js', { type: 'classic' });

    // Handle service worker updates
    wb.addEventListener('waiting', () => {
      updateAvailable = true;
      waitingServiceWorker = wb?.active?.serviceWorker || null;
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
          action: {
            label: 'Install Now',
            onClick: () => {
              updateServiceWorker();
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
    });

    // Handle service worker activated
    wb.addEventListener('activated', (event) => {
      notifyStatusListeners();
      if (event.isUpdate) {
        // New service worker activated, reload the page
        window.location.reload();
      }
    });

    // Handle service worker controlling
    wb.addEventListener('controlling', () => {
      notifyStatusListeners();
      window.location.reload();
    });

    // Handle service worker registered
    wb.addEventListener('registered', () => {
      notifyStatusListeners();
    });

    // Handle service worker errors - disable caching on critical errors
    wb.addEventListener('redundant', (event) => {
      console.error('[Service Worker] Service worker became redundant:', event);
      disableCachingAutomatically('Service worker became redundant (likely due to an error)');
    });

    // Handle external service worker errors
    navigator.serviceWorker.addEventListener('error', (event) => {
      console.error('[Service Worker] Service worker error event:', event);
      disableCachingAutomatically(`Service worker error: ${event.message || 'Unknown error'}`);
    });

    // Handle message errors from service worker
    navigator.serviceWorker.addEventListener('messageerror', (event) => {
      console.error('[Service Worker] Service worker message error:', event);
      // Don't disable on message errors - they're usually not critical
    });

      // Register the service worker
      await wb.register();
      notifyStatusListeners();

      // Check for updates periodically
      setInterval(() => {
        if (wb && options.enabled) {
          wb.update();
        }
      }, 60 * 60 * 1000); // Check every hour
    } catch (error) {
      // Handle registration errors - disable caching
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Service Worker] Registration failed:', error);
      
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
 */
export async function updateServiceWorker(): Promise<void> {
  if (!wb || !waitingServiceWorker) {
    return;
  }

  try {
    // Send skip waiting message to the waiting service worker
    waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
    
    // Wait for the new service worker to take control
    wb.addEventListener('controlling', () => {
      window.location.reload();
    });
  } catch (error) {
    console.error('Failed to update service worker:', error);
  }
}

/**
 * Unregister the service worker
 */
export async function unregisterServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.unregister();
      
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
    }
    wb = null;
    updateAvailable = false;
    waitingServiceWorker = null;
    notifyStatusListeners();
  } catch (error) {
    console.error('Failed to unregister service worker:', error);
  }
}

/**
 * Check if service worker is registered and active
 */
export async function isServiceWorkerRegistered(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
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
