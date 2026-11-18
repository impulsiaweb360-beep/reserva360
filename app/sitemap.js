import { SITE_URL } from '@/lib/site';
import { SECTORS } from '@/lib/marketing/sectors';
import { POSTS, BLOG_CATEGORIES } from '@/lib/marketing/blog';

// sitemap.xml dinámico: solo páginas públicas indexables
export default function sitemap() {
  const now = new Date().toISOString();
  const latestPost = POSTS.reduce((m, p) => (p.date > m ? p.date : m), '2026-01-01');
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    ...SECTORS.map((s) => ({ url: `${SITE_URL}/${s.slug}`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 })),
    { url: `${SITE_URL}/blog`, lastModified: latestPost, changeFrequency: 'weekly', priority: 0.7 },
    ...BLOG_CATEGORIES.map((c) => ({ url: `${SITE_URL}/blog/categoria/${c.slug}`, lastModified: latestPost, changeFrequency: 'weekly', priority: 0.5 })),
    ...POSTS.map((p) => ({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: p.date, changeFrequency: 'monthly', priority: 0.6 })),
    { url: `${SITE_URL}/auth/signup`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${SITE_URL}/cookies`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
