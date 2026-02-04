import { Workbox } from 'workbox-window';
import { shellui } from '@shellui/sdk';

let wb: Workbox | null = null;
let updateAvailable = false;
let waitingServiceWorker: ServiceWorker | null = null;
let registrationPromise: Promise<void> | null = null;
let statusListeners: Array<(status: { registered: boolean; updateAvailable: boolean }) => void> = [];

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
 * Check if service worker file exists
 */
export async function serviceWorkerFileExists(): Promise<boolean> {
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
    
    return isJavaScript || looksLikeServiceWorker;
  } catch (error) {
    // Any error (network, CORS, etc.) means the file doesn't exist or isn't accessible
    return false;
  }
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

  // Check if service worker file exists (only in production builds)
  const swExists = await serviceWorkerFileExists();
  if (!swExists) {
    console.warn('Service worker file not found. Service workers are only available in production builds.');
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
      // Only log error if it's not about missing file (we already checked)
      if (error instanceof Error && !error.message.includes('Failed to fetch') && !error.message.includes('insecure')) {
        console.error('Service worker registration failed:', error);
      } else if (error instanceof DOMException && error.name !== 'SecurityError') {
        console.error('Service worker registration failed:', error);
      }
      // Silently fail if service worker file doesn't exist (dev mode)
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
  // Immediately call with current status
  getServiceWorkerStatus().then(status => listener(status));
  
  // Return unsubscribe function
  return () => {
    statusListeners = statusListeners.filter(l => l !== listener);
  };
}
