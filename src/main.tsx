import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './components/AuthProvider';
import { RemoteConfigProvider } from './components/RemoteConfigProvider';
import { HelmetProvider } from 'react-helmet-async';
import { Capacitor } from '@capacitor/core';

// Native Firebase Crashlytics Unhandled Error Listener
if (Capacitor.isNativePlatform()) {
  import(/* @vite-ignore */ '@capacitor-firebase/crashlytics').then(({ FirebaseCrashlytics }) => {
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
