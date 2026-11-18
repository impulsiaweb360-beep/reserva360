// Configuración pública del sitio de marketing (SEO, analítica y oferta).
// No contiene secretos: todo lo que hay aquí se puede ver en el HTML público.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://reserva360.es').replace(/\/$/, '');
export const SITE_NAME = 'Reserva360';
export const SITE_EMAIL = 'reserva360.app@gmail.com';

// Contenedor de Google Tag Manager. GA4 se configura dentro de GTM.
export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || 'GTM-PV9TZ3P2';

export const SIGNUP_PATH = '/auth/signup';
export const LOGIN_PATH = '/auth/login';

// Oferta de acceso anticipado (fase de lanzamiento)
export const EARLY_ACCESS = {
  active: true,
  badge: 'Acceso anticipado',
  short: 'Gratis durante el lanzamiento',
  headline: 'Úsalo gratis mientras dure el lanzamiento',
  text:
    'Reserva360 ya es totalmente funcional y estamos en fase de lanzamiento. Si creas tu cuenta ahora, lo usas gratis hasta la apertura oficial y, a partir de ese momento, disfrutas de un 30 % de descuento durante tus 3 primeros meses.',
  discount: '30 %',
  months: 3,
  cta: 'Crear mi cuenta gratis',
  noCard: 'Sin tarjeta · Sin permanencia',
};

export const absoluteUrl = (path = '/') => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

export const DEFAULT_OG_IMAGE = '/og/reserva360-og.png';

// Metadatos coherentes para una página pública. `title` es el título completo (ya incluye la marca).
export function pageMetadata({ title, description, path = '/', image, type = 'website', publishedTime, modifiedTime }) {
  const url = absoluteUrl(path);
  const img = image || DEFAULT_OG_IMAGE;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type,
      url,
      title,
      description,
      siteName: SITE_NAME,
      locale: 'es_ES',
      images: [{ url: img, width: 1200, height: 630, alt: title }],
      ...(publishedTime ? { publishedTime } : {}),
      ...(modifiedTime ? { modifiedTime } : {}),
    },
    twitter: { card: 'summary_large_image', title, description, images: [img] },
  };
}
