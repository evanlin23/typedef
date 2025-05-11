// src/main.tsx
import React from 'react'; 
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App'; 

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found in the document.');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);