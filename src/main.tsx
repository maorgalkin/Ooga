
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
// Before App, so the first render already has the language and page direction
import './i18n';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';

const isDev = process.env.NODE_ENV === 'development';
const root = createRoot(document.getElementById('root')!);

if (isDev) {
  root.render(
    <React.StrictMode>
      <ErrorBoundary autoReloadOnCriticalError={false}>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
} else {
  // In production, auto-reload on critical errors after 3 seconds
  root.render(
    <ErrorBoundary autoReloadOnCriticalError={true} autoReloadDelay={3}>
      <App />
    </ErrorBoundary>
  );
}
