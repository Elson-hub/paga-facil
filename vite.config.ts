import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// O app é publicado em https://<usuario>.github.io/paga-facil/
// Se o repositório tiver outro nome, troque '/paga-facil/' abaixo.
export default defineConfig({
  base: '/paga-facil/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Paga Fácil',
        short_name: 'Paga Fácil',
        description: 'Controle financeiro pessoal',
        lang: 'pt-BR',
        theme_color: '#1E5BD8',
        background_color: '#F4F6FA',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
})
