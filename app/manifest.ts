import type { MetadataRoute } from 'next'

// Permite agregar el CRM a la pantalla de inicio del celular y abrirlo como una app (sin la barra del navegador).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Glauss CRM',
    short_name: 'Glauss CRM',
    description: 'CRM de Glauss Shop',
    lang: 'es-AR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: '/app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/app-icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
