import { toast } from 'react-hot-toast';

export interface ServiceWorkerConfig {
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onOfflineReady?: () => void;
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private config: ServiceWorkerConfig = {};

  async register(config: ServiceWorkerConfig = {}): Promise<void> {
    this.config = config;

    if ('serviceWorker' in navigator && 'caches' in window) {
      try {
        const baseUrl = import.meta.env.BASE_URL ?? '/';
        const scopeUrl = new URL(baseUrl, window.location.origin);
        const swUrl = new URL('sw.js', scopeUrl).toString();

        // Register the service worker
        this.registration = await navigator.serviceWorker.register(swUrl, {
          scope: scopeUrl.pathname
        });

        console.log('[SW] Service worker registered:', this.registration);

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
        
        toast.error('Offline features unavailable', {
          duration: 5000,
          position: 'bottom-right'
        });
      }
    } else {
      console.log('[SW] Service workers not supported');
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
            console.log('[SW] New content available');
            this.handleUpdate();
          } else {
            // Content is cached for offline use
            console.log('[SW] Content is cached for offline use');
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
      console.log('[SW] Message from service worker:', event.data);
      
      if (event.data && event.data.type === 'CACHE_UPDATED') {
        toast('New data cached', {
          duration: 3000,
          position: 'bottom-right'
        });
      }
    });

    // Listen for controlled state changes
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[SW] Controller changed, reloading page');
      window.location.reload();
    });
  }

  private handleUpdate(): void {
    if (this.config.onUpdate && this.registration) {
      this.config.onUpdate(this.registration);
    } else {
      // Default update handling
      const shouldUpdate = confirm(
        'A new version of the admin portal is available. Reload to update?'
      );
      
      if (shouldUpdate) {
        this.skipWaiting();
      } else {
        toast('Update available - refresh to get the latest version', {
          duration: 10000,
          position: 'bottom-right'
        });
      }
    }
  }

  async skipWaiting(): Promise<void> {
    if (this.registration?.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  private async checkForUpdates(): Promise<void> {
    if (this.registration) {
      try {
        await this.registration.update();
      } catch (error) {
        console.error('[SW] Update check failed:', error);
      }
    }
  }

  async unregister(): Promise<boolean> {
    if (this.registration) {
      const result = await this.registration.unregister();
      console.log('[SW] Service worker unregistered:', result);
      return result;
    }
    return false;
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