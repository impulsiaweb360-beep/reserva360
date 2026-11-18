import { notFound } from 'next/navigation';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import { PostCard, CategoryNav } from '@/components/marketing/BlogParts';
import JsonLd, { breadcrumbLd } from '@/components/marketing/JsonLd';
import { BLOG_CATEGORIES, getCategory, postsByCategory } from '@/lib/marketing/blog';
import { pageMetadata } from '@/lib/site';

export const dynamicParams = false;
export const generateStaticParams = () => BLOG_CATEGORIES.map((c) => ({ slug: c.slug }));

export function generateMetadata({ params }) {
  const c = getCategory(params.slug);
  if (!c) return {};
  return pageMetadata({ title: `${c.name}: artículos y guías | Blog Reserva360`, description: c.description, path: `/blog/categoria/${c.slug}` });
}

export default function CategoryPage({ params }) {
  const c = getCategory(params.slug);
  if (!c) notFound();
  const posts = postsByCategory(c.slug).sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <JsonLd data={breadcrumbLd([{ name: 'Inicio', path: '/' }, { name: 'Blog', path: '/blog' }, { name: c.name, path: `/blog/categoria/${c.slug}` }])} />
      <MarketingHeader />
      <main id="contenido" className="container mx-auto px-4 py-12 md:px-6 md:py-16">
        <header className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Blog · Categoría</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight">{c.name}</h1>
          <p className="mt-3 text-lg text-slate-600">{c.description}</p>
        </header>
        <div className="mt-8"><CategoryNav categories={BLOG_CATEGORIES} active={c.slug} /></div>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => <PostCard key={p.slug} post={p} />)}
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
