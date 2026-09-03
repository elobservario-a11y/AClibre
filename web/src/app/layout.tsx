import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Slowvan — Defensa del caravaning en España',
  description:
    'Infraestructura abierta para detectar, documentar y combatir restricciones injustificadas al caravaning en municipios de España.',
  openGraph: {
    title: 'Slowvan',
    description: 'Radar normativo y acción ciudadana frente a restricciones al caravaning.',
    url: 'https://slowvan.com',
    siteName: 'Slowvan',
    locale: 'es_ES',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${geist.className} min-h-screen bg-gray-50 text-gray-900 antialiased`}>
        <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <a href="/" className="flex items-center gap-2 font-bold text-orange-600">
              <span className="text-xl">🚐</span>
              <span>Slowvan</span>
            </a>
            <nav className="flex items-center gap-4 text-sm">
              <a href="/mapa" className="text-gray-600 hover:text-orange-600">Mapa</a>
              <a href="/contagio" className="text-gray-600 hover:text-orange-600">Contagio</a>
              <a href="/alertas" className="text-gray-600 hover:text-orange-600">Alertas</a>
              <a href="/mis-acciones" className="font-semibold text-gray-700 hover:text-orange-600">Mis Acciones</a>
              <a
                href="/reportar"
                className="rounded-xl bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600"
              >
                Reportar
              </a>
            </nav>
          </div>
        </header>
        {children}
        <footer className="mt-16 border-t border-gray-200 bg-white py-8 text-center text-xs text-gray-400">
          <div className="flex flex-wrap justify-center gap-4">
            <a href="/aviso-legal" className="hover:underline">Aviso legal</a>
            <a href="/privacidad" className="hover:underline">Privacidad</a>
            <a href="/terminos" className="hover:underline">Términos de uso</a>
            <a href="/moderacion" className="hover:underline">Moderación</a>
            <a href="/como-se-decide" className="hover:underline">Cómo se decide</a>
          </div>
          <p className="mt-3">
            © {new Date().getFullYear()} Jose Montero · info@slowvan.com ·{' '}
            <a
              href="https://github.com/acenlucha/acenlucha"
              className="hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Código AGPL-3.0
            </a>
          </p>
        </footer>
      </body>
    </html>
  )
}
