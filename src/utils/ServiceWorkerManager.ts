import { toast } from 'react-hot-toast';

const devLog = (...args: unknown[]) => {
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

export interface ServiceWorkerConfig {
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onOfflineReady?: () => void;
  onError?: (error: unknown) => void;
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private config: ServiceWorkerConfig = {};
  private updateFailureCount = 0;
  private readonly MAX_UPDATE_FAILURES = 3;
  private updateAccepted = false;

  async register(config: ServiceWorkerConfig = {}): Promise<void> {
    this.config = config;

    if ('serviceWorker' in navigator && 'caches' in window) {
      try {
        const swUrl = '/sw.js';
        
        // Register the service worker
        this.registration = await navigator.serviceWorker.register(swUrl, {
          scope: '/'
        });
        this.updateFailureCount = 0;

        devLog('[SW] Service worker registered:', this.registration);

        // Set up event listeners
        this.setupEventListeners();

        // Check for updates
        this.checkForUpdates();

        // Notify success
        if (this.config.onSuccess) {
          this.config.onSuccess(this.registration);
        }

      } catch (error) {
        console.error('[SW] Service worker registration failed:', error);
        this.handleError(error);
      }
    } else {
      devLog('[SW] Service workers not supported');
    }
  }

  private setupEventListeners(): void {
    if (!this.registration) return;

    // Listen for updates
    this.registration.addEventListener('updatefound', () => {
      const installingWorker = this.registration!.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // New update available
            devLog('[SW] New content available');
            this.handleUpdate();
          } else {
            // Content is cached for offline use
            devLog('[SW] Content is cached for offline use');
            if (this.config.onOfflineReady) {
              this.config.onOfflineReady();
            } else {
              toast.success('Admin portal ready for offline use', {
                duration: 5000,
                position: 'bottom-right'
              });
            }
          }
        }
      });
    });

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      devLog('[SW] Message from service worker:', event.data);
      
      if (event.data && event.data.type === 'CACHE_UPDATED') {
        toast('New data cached', {
          duration: 3000,
          position: 'bottom-right'
        });
      }
    });

    // Listen for controlled state changes
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      devLog('[SW] Controller changed');
      if (this.updateAccepted) {
        window.location.reload();
        return;
      }

      toast.custom((t) => (
        <div className="bg-charcoal text-white px-4 py-3 rounded shadow-lg flex flex-col gap-2 w-80">
          <div>
            <p className="text-sm font-semibold">Update ready</p>
            <p className="text-xs text-white/80">Refresh when you’re done editing.</p>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              className="px-3 py-1 text-sm rounded bg-sunrise text-charcoal font-semibold"
              onClick={() => {
                toast.dismiss(t.id);
                this.applyUpdate(this.registration);
              }}
            >
              Refresh
            </button>
          </div>
        </div>
      ), { duration: 120000, position: 'bottom-right' });
    });
  }

  private handleUpdate(): void {
    if (this.registration) {
      if (this.config.onUpdate) {
        this.config.onUpdate(this.registration);
        return;
      }
      this.promptUpdate(this.registration);
    }
  }

  async skipWaiting(): Promise<void> {
    await this.applyUpdate();
  }

  private async checkForUpdates(): Promise<void> {
    if (this.registration) {
      try {
        await this.registration.update();
      } catch (error) {
        console.error('[SW] Update check failed:', error);
        this.handleError(error);
      }
    }
  }

  async unregister(): Promise<boolean> {
    if (this.registration) {
      const result = await this.registration.unregister();
      devLog('[SW] Service worker unregistered:', result);
      return result;
    }
    return false;
  }

  promptUpdate(registration: ServiceWorkerRegistration): void {
    toast.custom((t) => (
      <div className="bg-charcoal text-white px-4 py-3 rounded shadow-lg flex flex-col gap-2 w-80">
        <div>
          <p className="text-sm font-semibold">Update available</p>
          <p className="text-xs text-white/80">Refresh to load the newest admin experience.</p>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            className="px-3 py-1 text-sm rounded border border-white/40 text-white hover:bg-white/10"
            onClick={() => toast.dismiss(t.id)}
          >
            Later
          </button>
          <button
            className="px-3 py-1 text-sm rounded bg-sunrise text-charcoal font-semibold"
            onClick={() => {
              toast.dismiss(t.id);
              this.applyUpdate(registration);
            }}
          >
            Refresh
          </button>
        </div>
      </div>
    ), { duration: 10000, position: 'bottom-right' });
  }

  async applyUpdate(registration: ServiceWorkerRegistration | null = this.registration): Promise<void> {
    if (!registration?.waiting) {
      this.incrementUpdateFailure(new Error('No waiting service worker found.'));
      return;
    }

    try {
      this.updateAccepted = true;
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      setTimeout(() => {
        window.location.reload();
      }, 150);
    } catch (error) {
      this.incrementUpdateFailure(error);
    }
  }

  private incrementUpdateFailure(error: unknown): void {
    this.updateFailureCount += 1;
    console.warn('[SW] Update attempt failed', error);
    if (this.updateFailureCount >= this.MAX_UPDATE_FAILURES) {
      toast.error('Offline caching disabled temporarily. Reloading…', {
        duration: 6000,
        position: 'bottom-right',
      });
      this.unregister()
        .then(() => window.location.reload())
        .catch((cleanupError) => console.error('[SW] Failed to unregister after repeated failures', cleanupError));
      return;
    }
    this.handleError(error);
  }

  private handleError(error: unknown): void {
    if (this.config.onError) {
      this.config.onError(error);
      return;
    }
    toast.error('Service worker issue detected. Please refresh.', {
      duration: 5000,
      position: 'bottom-right',
    });
  }

  async forceCleanup(): Promise<void> {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return;
    }

    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map(async (registration) => {
            const didUnregister = await registration.unregister();
            if (didUnregister) {
              console.log('[SW] Unregistered dev service worker:', registration.scope);
            }
          })
        );
      } catch (error) {
        console.warn('[SW] Failed to unregister service workers during dev cleanup:', error);
      }
    }

    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
        console.log('[SW] Cleared caches during dev cleanup');
      } catch (error) {
        console.warn('[SW] Failed to clear caches during dev cleanup:', error);
      }
    }
  }

  // Cache management utilities
  async clearCache(): Promise<void> {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      console.log('[SW] All caches cleared');
      
      toast.success('Cache cleared successfully', {
        duration: 3000,
        position: 'bottom-right'
      });
    }
  }

  async getCacheSize(): Promise<number> {
    if (!('caches' in window)) return 0;

    let totalSize = 0;
    const cacheNames = await caches.keys();
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      
      for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }
    }
    
    return totalSize;
  }

  async getCacheInfo(): Promise<{
    size: string;
    count: number;
    caches: Array<{ name: string; count: number }>;
  }> {
    if (!('caches' in window)) {
      return { size: '0 B', count: 0, caches: [] };
    }

    let totalSize = 0;
    let totalCount = 0;
    const cacheDetails: Array<{ name: string; count: number }> = [];
    
    const cacheNames = await caches.keys();
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      let cacheSize = 0;
      
      for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          cacheSize += blob.size;
          totalCount++;
        }
      }
      
      totalSize += cacheSize;
      cacheDetails.push({ name: cacheName, count: requests.length });
    }
    
    return {
      size: this.formatBytes(totalSize),
      count: totalCount,
      caches: cacheDetails
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Network status monitoring
  setupNetworkMonitoring(): () => void {
    const updateOnlineStatus = () => {
      if (navigator.onLine) {
        toast.success('Back online', {
          duration: 3000,
          position: 'bottom-right'
        });
      } else {
        toast.error('You are offline', {
          duration: Infinity,
          position: 'bottom-right'
        });
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }

  isOnline(): boolean {
    return navigator.onLine;
  }
}

// Create singleton instance
const serviceWorkerManager = new ServiceWorkerManager();

export default serviceWorkerManager;
