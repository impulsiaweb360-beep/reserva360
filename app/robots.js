import { SITE_URL } from '@/lib/site';

// robots.txt: se rastrea la web pública; nunca el panel, la API ni las páginas privadas de gestión de citas
export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/api/', '/manage/', '/auth/login', '/auth/forgot-password', '/auth/reset-password', '/auth/check-email', '/auth/callback'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
