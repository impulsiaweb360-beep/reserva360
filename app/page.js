import Landing from '@/components/marketing/Landing';
import { pageMetadata } from '@/lib/site';

export const metadata = pageMetadata({
  title: 'Software de gestión de citas y reservas online | Reserva360',
  description:
    'Programa de reservas online para negocios con cita previa: agenda por profesional, reservas 24 h, recordatorios automáticos, clientes y empleados en una sola plataforma.',
  path: '/',
});

export default function HomePage() {
  return <Landing />;
}
