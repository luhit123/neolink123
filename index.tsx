
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

// Make database initialization available globally for manual use
import('./databaseInit').then(({ initializeDatabase }) => {
  (window as any).initializeNeoLinkDatabase = initializeDatabase;
  console.log('🔧 Database initialization available: run initializeNeoLinkDatabase() in console');
});
