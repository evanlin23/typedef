// src/main.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'; // Import BrowserRouter
import './index.css';
import App from './App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found in the document.');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    {/* Wrap App with BrowserRouter and set basename */}
    <BrowserRouter basename="/struct">
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);