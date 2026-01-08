
import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA Service Worker Registration
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('✅ PWA Service Worker registered:', registration.scope);

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000); // Check every hour
      })
      .catch((error) => {
        console.error('❌ Service Worker registration failed:', error);
      });

    // Listen for service worker updates
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('🔄 New service worker activated, reloading...');
      window.location.reload();
    });
  });
}

// Add to home screen prompt handling (Android)
let deferredPrompt: any;
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('💾 Install prompt available');
  e.preventDefault();
  deferredPrompt = e;

  // Show custom install button if desired
  // This can be triggered later via a button: deferredPrompt.prompt()
});

// Track when app is installed
window.addEventListener('appinstalled', () => {
  console.log('✅ PWA installed successfully');
  deferredPrompt = null;
});

// Make database initialization available globally for manual use
// Database initialization module is specific to local environment and not included in production build
// import('./databaseInit').then(({ initializeDatabase }) => {
//   (window as any).initializeNeoLinkDatabase = initializeDatabase;
//   console.log('🔧 Database initialization available: run initializeNeoLinkDatabase() in console');
// });
