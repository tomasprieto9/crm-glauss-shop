import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Archivo, Archivo_Narrow, Inter } from 'next/font/google'
import './globals.css'

// Tipografías del sistema de diseño de Glauss: Inter (interfaz), Archivo Narrow (títulos y nombres)
// y Archivo ExtraBold (montos).
const inter = Inter({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--fuente-ui' })
const archivoNarrow = Archivo_Narrow({ subsets: ['latin'], weight: ['600', '700'], variable: '--fuente-display' })
const archivo = Archivo({ subsets: ['latin'], weight: ['800'], variable: '--fuente-precio' })

export const metadata: Metadata = {
  title: 'Glauss CRM',
  description: 'CRM de Glauss Shop',
  icons: {
    icon: [{ url: '/icon-32.png', sizes: '32x32', type: 'image/png' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#ffffff',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${archivoNarrow.variable} ${archivo.variable}`}>
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
