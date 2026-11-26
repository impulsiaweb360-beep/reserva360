import Landing from '@/components/marketing/Landing';
import { pageMetadata } from '@/lib/site';

export const metadata = pageMetadata({
  title: 'Reserva360 | App de gestión de citas y reservas por WhatsApp',
  description:
    'App y software de gestión de citas, control de reservas y asistente virtual por WhatsApp 24/7. Reduce ausencias en tu negocio. Prueba Reserva360.',
  path: '/',
});

export default function HomePage() {
  return <Landing />;
}
