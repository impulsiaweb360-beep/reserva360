import './globals.css';
import { Toaster } from '@/components/ui/sonner';

export const metadata = {
  title: 'Bookly · SaaS de Gestión de Citas',
  description: 'Plataforma multi-tenant de reservas para fisios, peluquerías, veterinarios y más.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
