import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './components/AuthProvider';
import { RemoteConfigProvider } from './components/RemoteConfigProvider';
import { HelmetProvider } from 'react-helmet-async';
import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';

// Register service worker for offline support and versioned cache management
if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  // Clear legacy or outdated versioned caches on startup
  if ('caches' in window) {
    const activeCachePrefix = 'anytrader-v1.0.0';
    caches.keys().then((cacheNames) => {
      cacheNames.forEach((cacheName) => {
        if (cacheName.startsWith('anytrader-') && !cacheName.startsWith(activeCachePrefix)) {
          console.log(`[SW] Purging outdated cache: ${cacheName}`);
          caches.delete(cacheName);
        }
      });
    }).catch((err) => console.warn('[SW] Cache cleanup check error:', err));
  }

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('App update available. Activating new service worker...');
      updateSW(true);
    },
    onOfflineReady() {
      console.log('App ready to work offline');
    },
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        // Periodically check for updates every hour
        setInterval(() => {
          registration.update().catch((e) => console.warn('[SW] Periodic update check failed:', e));
        }, 60 * 60 * 1000);
      }
    }
  });

  // Automatically refresh window when a new service worker controller takes over
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      console.log('[SW] Controller updated. Reloading page to ensure latest code execution...');
      window.location.reload();
    }
  });

  // Check for updates when the app comes back online
  window.addEventListener('online', () => {
    console.log('App is back online, checking for updates...');
    updateSW(true);
  });
}


// Save the last known web origin for dynamic server-side routing inside Capacitor
if (!Capacitor.isNativePlatform() && typeof window !== 'undefined') {
  try {
    localStorage.setItem('last_known_origin', window.location.origin);
  } catch (e) {
    console.warn('Failed to save last_known_origin:', e);
  }
}

// Global Fetch Interceptor for Capacitor Native Platforms to redirect relative paths
if (Capacitor.isNativePlatform()) {
  const originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    let url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : (input && 'url' in input ? (input as any).url : ''));
    
    // Explicitly exclude Firebase and Google API endpoints from redirection
    if (typeof url === 'string' && (
      url.includes('identitytoolkit.googleapis.com') ||
      url.includes('securetoken.googleapis.com') ||
      url.includes('firebasestorage.googleapis.com') ||
      url.includes('firestore.googleapis.com')
    )) {
      return originalFetch.apply(this, [input, init]);
    }
    
    if (typeof url === 'string' && url.startsWith('/api/')) {
      const envUrl = (import.meta as any).env?.VITE_API_URL || (import.meta as any).env?.VITE_APP_URL || (import.meta as any).env?.APP_URL;
      let baseUrl = "";
      if (envUrl) {
        baseUrl = envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
      } else {
        try {
          const lastOrigin = localStorage.getItem('last_known_origin');
          if (lastOrigin) {
            baseUrl = lastOrigin.endsWith('/') ? lastOrigin.slice(0, -1) : lastOrigin;
          }
        } catch (e) {
          console.warn('Failed to read last_known_origin:', e);
        }
      }
      
      if (!baseUrl) {
        baseUrl = "https://ais-dev-vumupz44ljjitc6rsqobbz-437256678397.europe-west2.run.app";
      }
      
      const newUrl = `${baseUrl}${url}`;
      console.log(`[Capacitor Fetch interceptor] Resolving relative API call: ${url} -> ${newUrl}`);
      
      if (typeof input === 'string') {
        input = newUrl;
      } else if (input instanceof URL) {
        input = new URL(newUrl);
      } else if (input && typeof input === 'object') {
        try {
          input = new Request(newUrl, input as any);
        } catch (requestErr) {
          console.warn('Failed to construct Request object in interceptor, using string path:', requestErr);
          input = newUrl;
        }
      }
    }
    return originalFetch.apply(this, [input, init]);
  };
}

// Native Firebase Crashlytics Unhandled Error Listener
if (Capacitor.isNativePlatform()) {
  const crashlyticsPkg = '@capacitor-firebase/crashlytics';
  import(/* @vite-ignore */ crashlyticsPkg).then(({ FirebaseCrashlytics }: any) => {
    window.addEventListener("error", (event) => {
      FirebaseCrashlytics.recordException({
        message: event.error?.message || event.message || 'Unknown Error',
        stacktrace: event.error?.stack || ''
      }).catch(() => {});
    });
    
    window.addEventListener("unhandledrejection", (event) => {
      FirebaseCrashlytics.recordException({
        message: event.reason?.message || String(event.reason) || 'Unhandled Promise Rejection',
        stacktrace: event.reason?.stack || ''
      }).catch(() => {});
    });
  }).catch(e => console.error("Could not load Crashlytics for main error boundary:", e));
}

const originalConsoleError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('DIRECTIONS_ROUTE: UNKNOWN_ERROR')) {
    return; // Suppress internal Google Maps SDK noise
  }
  originalConsoleError(...args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <AuthProvider>
          <RemoteConfigProvider>
            <App />
          </RemoteConfigProvider>
        </AuthProvider>
      </HelmetProvider>
    </ErrorBoundary>
  </StrictMode>,
);
