import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { aplicarAparenciaSalva } from './lib/temas'
import './styles.css'

aplicarAparenciaSalva()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
