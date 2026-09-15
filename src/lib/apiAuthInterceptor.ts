import { Capacitor } from '@capacitor/core';
import { auth } from '../firebase';
import { getApiUrl } from './apiUrl';

let isInterceptorInstalled = false;

/**
 * Installs a global fetch interceptor that:
 * 1. Resolves relative /api/... URLs to the correct backend host on native Capacitor platforms.
 * 2. Automatically injects the user's Firebase ID token (`Authorization: Bearer <token>`)
 *    into all outgoing requests targeting `/api/...` endpoints, eliminating the risk of 401s
 *    when server routes are protected.
 * 3. Preserves all caller-specified headers and options.
 */
export function installApiAuthInterceptor(): void {
  if (typeof window === 'undefined' || !window.fetch) {
    return;
  }

  if (isInterceptorInstalled) {
    return;
  }

  const originalFetch = window.fetch;

  const interceptedFetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    try {
      let rawUrl = '';
      if (typeof input === 'string') {
        rawUrl = input;
      } else if (input instanceof URL) {
        rawUrl = input.toString();
      } else if (input && typeof input === 'object' && 'url' in input) {
        rawUrl = (input as Request).url;
      }

      // Check if this request is targeting our /api/ endpoints
      const isApiRoute =
        rawUrl.startsWith('/api/') ||
        rawUrl.includes('/api/');

      // Exclude third-party Google, Firebase, or external services
      const isExternalService =
        rawUrl.includes('identitytoolkit.googleapis.com') ||
        rawUrl.includes('securetoken.googleapis.com') ||
        rawUrl.includes('firebasestorage.googleapis.com') ||
        rawUrl.includes('firestore.googleapis.com') ||
        rawUrl.includes('postcodes.io') ||
        rawUrl.includes('googleapis.com') ||
        rawUrl.includes('ipify.org');

      if (isApiRoute && !isExternalService) {
        // Resolve URL on native platforms if relative
        if (Capacitor.isNativePlatform() && rawUrl.startsWith('/api/')) {
          const resolvedUrl = getApiUrl(rawUrl);
          if (typeof input === 'string') {
            input = resolvedUrl;
          } else if (input instanceof URL) {
            input = new URL(resolvedUrl);
          } else if (input && typeof input === 'object' && 'url' in input) {
            try {
              input = new Request(resolvedUrl, input as RequestInit);
            } catch {
              input = resolvedUrl;
            }
          }
        }

        // Retrieve current Firebase ID token if user is signed in
        let idToken: string | null = null;
        try {
          if (auth && auth.currentUser) {
            idToken = await auth.currentUser.getIdToken();
          }
        } catch (tokenErr) {
          console.warn('[API Interceptor] Failed to retrieve Firebase ID token:', tokenErr);
        }

        // Attach Authorization header if token is available
        if (idToken) {
          init = init ? { ...init } : {};

          if (!init.headers) {
            init.headers = {
              Authorization: `Bearer ${idToken}`,
            };
          } else if (init.headers instanceof Headers) {
            if (!init.headers.has('Authorization')) {
              init.headers.set('Authorization', `Bearer ${idToken}`);
            }
          } else if (Array.isArray(init.headers)) {
            const hasAuth = init.headers.some(
              ([key]) => key.toLowerCase() === 'authorization'
            );
            if (!hasAuth) {
              init.headers = [...init.headers, ['Authorization', `Bearer ${idToken}`]];
            }
          } else if (typeof init.headers === 'object') {
            const headerKeys = Object.keys(init.headers);
            const hasAuth = headerKeys.some(
              (key) => key.toLowerCase() === 'authorization'
            );
            if (!hasAuth) {
              init.headers = {
                ...init.headers,
                Authorization: `Bearer ${idToken}`,
              };
            }
          }
        }
      }
    } catch (interceptorErr) {
      console.warn('[API Interceptor] Error during fetch preprocessing:', interceptorErr);
    }

    return originalFetch.apply(window, [input, init]);
  };

  try {
    Object.defineProperty(window, 'fetch', {
      writable: true,
      configurable: true,
      value: interceptedFetch,
    });
  } catch {
    try {
      (window as any).fetch = interceptedFetch;
    } catch (err) {
      console.warn('[API Interceptor] Could not override window.fetch:', err);
      return;
    }
  }

  isInterceptorInstalled = true;
  console.log('[API Interceptor] Global API Auth Interceptor successfully mounted.');
}
