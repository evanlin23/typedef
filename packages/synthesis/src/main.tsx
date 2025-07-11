import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <App /> 
  );
} else {
  console.error('Failed to find the root element');
}