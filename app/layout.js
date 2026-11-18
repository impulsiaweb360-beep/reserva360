import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import ConsentManager from '@/components/marketing/ConsentManager';
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '@/lib/site';

const TITLE = 'Software de gestión de citas y reservas online | Reserva360';
const DESCRIPTION =
  'Programa de reservas online para negocios con cita previa: agenda por profesional, reservas 24 h, recordatorios automáticos, clientes y empleados en una sola plataforma.';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s | Reserva360' },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'es_ES',
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: 'Reserva360, software de gestión de citas y reservas online' }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [DEFAULT_OG_IMAGE] },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export const viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://www.googletagmanager.com" />
      </head>
      <body className="antialiased">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow">
          Saltar al contenido
        </a>
        {children}
        <ConsentManager />
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
