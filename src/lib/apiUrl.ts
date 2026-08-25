import { Capacitor } from '@capacitor/core';

/**
 * Returns the fully qualified backend API URL.
 * On web, relative paths like '/api/...' work out of the box.
 * On native platforms (Capacitor Android / iOS), relative paths resolve to local WebView origin (https://localhost),
 * which fails because no backend server runs on the physical mobile device.
 */
export function getApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  if (!Capacitor.isNativePlatform()) {
    return normalizedPath;
  }

  const envUrl = (import.meta as any).env?.VITE_API_URL || 
                 (import.meta as any).env?.VITE_APP_URL || 
                 (import.meta as any).env?.APP_URL;

  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    const cleanUrl = envUrl.trim().endsWith('/') ? envUrl.trim().slice(0, -1) : envUrl.trim();
    return `${cleanUrl}${normalizedPath}`;
  }

  try {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      const currentOrigin = window.location.origin;
      if (
        !currentOrigin.includes('localhost') &&
        !currentOrigin.includes('127.0.0.1') &&
        !currentOrigin.startsWith('capacitor://') &&
        !currentOrigin.startsWith('ionic://') &&
        !currentOrigin.startsWith('file://')
      ) {
        const cleanOrigin = currentOrigin.endsWith('/') ? currentOrigin.slice(0, -1) : currentOrigin;
        return `${cleanOrigin}${normalizedPath}`;
      }
    }

    const lastOrigin = localStorage.getItem('last_known_origin');
    if (
      lastOrigin &&
      !lastOrigin.includes('localhost') &&
      !lastOrigin.includes('127.0.0.1') &&
      !lastOrigin.startsWith('capacitor://') &&
      !lastOrigin.startsWith('ionic://') &&
      !lastOrigin.startsWith('http://localhost') &&
      !lastOrigin.startsWith('https://localhost') &&
      !lastOrigin.startsWith('file://')
    ) {
      const cleanOrigin = lastOrigin.endsWith('/') ? lastOrigin.slice(0, -1) : lastOrigin;
      return `${cleanOrigin}${normalizedPath}`;
    }
  } catch (e) {
    console.warn('[API URL] Could not read origin:', e);
  }

  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return `${window.location.origin.endsWith('/') ? window.location.origin.slice(0, -1) : window.location.origin}${normalizedPath}`;
  }

  return normalizedPath;
}
