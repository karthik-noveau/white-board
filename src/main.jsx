import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App.jsx'


const app = (
  <React.StrictMode>
    <BrowserRouter><App /></BrowserRouter>
  </React.StrictMode>
);
const root = document.getElementById('root');
if (root.dataset.prerendered === window.location.pathname.replace(/\/$/, '') || (root.dataset.prerendered === '/' && window.location.pathname === '/')) {
  ReactDOM.hydrateRoot(root, app);
} else ReactDOM.createRoot(root).render(app);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
