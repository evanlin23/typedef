import React from 'react' // React 19 doesn't require StrictMode explicitly for its benefits.
import { createRoot } from 'react-dom/client'
import './index.css' // Ensure Tailwind base, components, utilities are imported here
import App from './App.tsx'

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    // React 19 makes StrictMode behaviors default in dev, so explicit tag is less critical
    // but can be kept for clarity or if specific StrictMode-only checks are desired.
    // For this exercise, let's assume default behavior is sufficient.
    <App /> 
  );
} else {
  console.error('Failed to find the root element');
}