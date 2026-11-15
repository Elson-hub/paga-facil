import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Carimbo da publicação no formato DDHHmm (dia, hora, minuto), no horário
 * de Cuiabá. Ex.: 15/11 às 17:13 → "151713". Gerado a cada build.
 */
function carimboDaPublicacao() {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Cuiaba', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date()).map(p => [p.type, p.value])
  )
  return {
    codigo: `${partes.day}${partes.hour}${partes.minute}`,
    data: `${partes.day}/${partes.month}/${partes.year} às ${partes.hour}:${partes.minute}`
  }
}
const publicacao = carimboDaPublicacao()

// O app é publicado em https://<usuario>.github.io/paga-facil/
// Se o repositório tiver outro nome, troque '/paga-facil/' abaixo.
export default defineConfig({
  base: '/paga-facil/',
  define: {
    __PUBLICACAO_CODIGO__: JSON.stringify(publicacao.codigo),
    __PUBLICACAO_DATA__: JSON.stringify(publicacao.data)
  },
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
