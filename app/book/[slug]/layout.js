import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { absoluteUrl } from '@/lib/site';

// Título y descripción propios para la página de reservas de cada negocio (solo lectura)
export async function generateMetadata({ params }) {
  const slug = params?.slug;
  let t = null;
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin.from('tenants').select('name, industry, address, status').eq('slug', slug).maybeSingle();
    t = data;
  } catch {
    /* sin datos: metadatos genéricos */
  }
  if (!t || t.status === 'suspended' || t.status === 'cancelled') {
    return { title: { absolute: 'Reservar cita online | Reserva360' }, robots: { index: false, follow: true } };
  }
  const title = `Reservar cita en ${t.name} | Reserva360`;
  const description = `Reserva tu cita online en ${t.name}${t.industry ? ` (${t.industry})` : ''}${t.address ? `, ${t.address}` : ''}. Elige servicio, profesional, día y hora en un minuto.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: absoluteUrl(`/book/${slug}`) },
    openGraph: { title, description, url: absoluteUrl(`/book/${slug}`), type: 'website' },
  };
}

export default function BookLayout({ children }) {
  return children;
}
