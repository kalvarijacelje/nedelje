import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { NotificationQueueProvider } from './context/NotificationQueueContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NotificationQueueProvider>
      <App />
    </NotificationQueueProvider>
  </StrictMode>,
);

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('PWA service worker registration error:', err);
    });
  });
}

