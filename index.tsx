
import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// PWA Service Worker Registration
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Check for updates every hour
        setInterval(() => { registration.update(); }, 60 * 60 * 1000);
      })
      .catch((_error) => {
        // SW registration failure is non-fatal; app still works without offline support
      });

    // Reload when new service worker takes control
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  });
}

// Add to home screen prompt handling (Android)
let deferredPrompt: BeforeInstallPromptEvent | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
});

// Make database initialization available globally for manual use
// Database initialization module is specific to local environment and not included in production build
// import('./databaseInit').then(({ initializeDatabase }) => {
//   (window as any).initializeNeoLinkDatabase = initializeDatabase;
//   console.log('🔧 Database initialization available: run initializeNeoLinkDatabase() in console');
// });
