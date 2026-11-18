import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import { PostCard, CategoryNav } from '@/components/marketing/BlogParts';
import JsonLd, { breadcrumbLd } from '@/components/marketing/JsonLd';
import { BLOG_CATEGORIES, sortedPosts } from '@/lib/marketing/blog';
import { pageMetadata } from '@/lib/site';

export const metadata = pageMetadata({
  title: 'Blog de gestión de citas y reservas para negocios | Reserva360',
  description: 'Guías prácticas para organizar tu agenda, reducir ausencias, gestionar horarios de empleados y conseguir más reservas en tu negocio.',
  path: '/blog',
});

export default function BlogIndex() {
  const posts = sortedPosts();
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <JsonLd data={breadcrumbLd([{ name: 'Inicio', path: '/' }, { name: 'Blog', path: '/blog' }])} />
      <MarketingHeader />
      <main id="contenido" className="container mx-auto px-4 py-12 md:px-6 md:py-16">
        <header className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Blog de Reserva360</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight md:text-5xl">Ideas prácticas para gestionar las citas de tu negocio</h1>
          <p className="mt-4 text-lg text-slate-600">Organización de la agenda, recordatorios, equipos y digitalización, explicados de forma sencilla.</p>
        </header>
        <div className="mt-8"><CategoryNav categories={BLOG_CATEGORIES} /></div>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => <PostCard key={p.slug} post={p} />)}
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
