import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { shellui } from '@shellui/sdk/tiny'
import './index.css'
import App from './App.jsx'

// Light Shellui host handshake when embedded (no-op outside the shell).
void shellui.ready

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
