import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { preconnectMedia } from '@/lib/media'
import './index.css'

// Before React even mounts: the handshake with the media origin overlaps the
// first render instead of queueing behind it.
preconnectMedia()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
