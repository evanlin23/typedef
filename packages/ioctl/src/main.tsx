import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { prepareBrowserIsolation } from './browserIsolation'

// Finish isolation setup before accepting files so a first-load reload cannot
// discard selected files or interrupt a tool.
void prepareBrowserIsolation().then((render) => {
  if (!render) return;
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter basename="/ioctl/">
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
})
