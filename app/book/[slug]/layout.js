import { cache } from 'react';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { absoluteUrl } from '@/lib/site';
import JsonLd from '@/components/marketing/JsonLd';
import { InitialTenantProvider } from './initial-tenant';

// Misma función pública que usa el navegador: solo datos públicos del negocio (servicios y profesionales activos)
const loadPublicTenant = cache(async (slug) => {
  if (!slug) return null;
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc('get_public_tenant', { p_slug: slug });
    if (error || !data) return null;
    return data;
  } catch {
    return null; // si falla, la página carga los datos en el navegador como antes
  }
});

export async function generateMetadata({ params }) {
  const slug = params?.slug;
  const t = await loadPublicTenant(slug);
  if (!t) return { title: { absolute: 'Reservar cita online | Reserva360' }, robots: { index: false, follow: true } };
  const services = (t.services || []).filter((s) => s.active !== false).map((s) => s.name).slice(0, 4);
  const title = `Reservar cita en ${t.name} | Reserva360`;
  const description = `Reserva tu cita online en ${t.name}${t.industry ? ` (${t.industry})` : ''}${t.address ? `, ${t.address}` : ''}.${services.length ? ` ${services.join(', ')}.` : ''} Elige día y hora en un minuto.`.slice(0, 300);
  const url = absoluteUrl(`/book/${slug}`);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
  };
}

export default async function BookLayout({ children, params }) {
  const t = await loadPublicTenant(params?.slug);
  // Datos estructurados solo con información real del negocio
  const ld = t && {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: t.name,
    url: absoluteUrl(`/book/${t.slug || params?.slug}`),
    ...(t.address ? { address: t.address } : {}),
    ...(t.phone ? { telephone: t.phone } : {}),
    ...(t.logo && /^https?:\/\//.test(t.logo) ? { image: t.logo } : {}),
    makesOffer: (t.services || []).filter((s) => s.active !== false).slice(0, 20).map((s) => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name: s.name },
      ...(Number(s.price) > 0 ? { price: String(Number(s.price)), priceCurrency: 'EUR' } : {}),
    })),
  };
  return (
    <InitialTenantProvider value={t}>
      {ld && <JsonLd data={ld} />}
      {children}
    </InitialTenantProvider>
  );
}
