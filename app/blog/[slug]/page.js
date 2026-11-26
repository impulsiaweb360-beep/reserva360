import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Clock, Lightbulb } from 'lucide-react';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import { PostCard, formatDate } from '@/components/marketing/BlogParts';
import { PrimaryCta, CtaNote } from '@/components/marketing/CtaButtons';
import JsonLd, { breadcrumbLd } from '@/components/marketing/JsonLd';
import { POSTS, getPost, getCategory } from '@/lib/marketing/blog';
import { getSector } from '@/lib/marketing/sectors';
import { pageMetadata, absoluteUrl, SITE_NAME } from '@/lib/site';

export const dynamicParams = false;
export const generateStaticParams = () => POSTS.map((p) => ({ slug: p.slug }));

export function generateMetadata({ params }) {
  const p = getPost(params.slug);
  if (!p) return {};
  // seoTitle / seoDescription opcionales: permiten un title y meta description distintos del H1
  return pageMetadata({
    title: p.seoTitle || `${p.title} | Reserva360`,
    description: p.seoDescription || p.description,
    path: `/blog/${p.slug}`,
    type: 'article',
    publishedTime: p.date,
    ...(p.updated ? { modifiedTime: p.updated } : {}),
  });
}

// Texto con enlaces internos: un string o un array de partes (string | { href, text } | { strong })
function Inline({ v }) {
  if (!Array.isArray(v)) return v;
  return v.map((part, i) => {
    if (typeof part === 'string') return <span key={i}>{part}</span>;
    if (part?.strong) return <strong key={i}>{part.strong}</strong>;
    return <Link key={i} href={part.href} className="font-medium text-indigo-700 underline decoration-indigo-200 underline-offset-2 hover:decoration-indigo-600">{part.text}</Link>;
  });
}

function Block({ b }) {
  const [type, v] = b;
  if (type === 'h2') return <h2 id={b[2]} className="mt-10 scroll-mt-24 text-2xl font-bold tracking-tight">{v}</h2>;
  if (type === 'h3') return <h3 className="mt-6 text-lg font-semibold">{v}</h3>;
  if (type === 'p') return <p className="mt-4 leading-relaxed text-slate-700"><Inline v={v} /></p>;
  if (type === 'ul') return <ul className="mt-4 list-disc space-y-2 pl-6 text-slate-700">{v.map((x, i) => <li key={i}><Inline v={x} /></li>)}</ul>;
  if (type === 'ol') return <ol className="mt-4 list-decimal space-y-2 pl-6 text-slate-700">{v.map((x, i) => <li key={i}><Inline v={x} /></li>)}</ol>;
  if (type === 'table') {
    return (
      <figure className="mt-6">
        {v.caption && <figcaption className="mb-3 text-sm font-semibold text-slate-900">{v.caption}</figcaption>}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-900">
              <tr>{v.head.map((h) => <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {v.rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => (j === 0
                  ? <th key={j} scope="row" className="px-4 py-3 font-medium text-slate-900">{c}</th>
                  : <td key={j} className="px-4 py-3 align-top"><Inline v={c} /></td>))}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </figure>
    );
  }
  if (type === 'cta') {
    return (
      <aside className="mt-6 flex flex-col gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
        <p>{v.text}</p>
        <Link href={v.href} className="shrink-0 font-semibold text-indigo-700 hover:underline">{v.label} →</Link>
      </aside>
    );
  }
  if (type === 'tip') {
    return (
      <aside className="mt-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <Lightbulb className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /><p><strong>Consejo:</strong> {v}</p>
      </aside>
    );
  }
  return null;
}

export default function PostPage({ params }) {
  const p = getPost(params.slug);
  if (!p) notFound();
  const cat = getCategory(p.category);
  const sector = p.sector ? getSector(p.sector) : null;
  const more = POSTS.filter((x) => x.slug !== p.slug && (x.category === p.category || x.sector === p.sector)).slice(0, 3);
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: p.title,
    description: p.description,
    datePublished: p.date,
    dateModified: p.updated || p.date,
    inLanguage: 'es-ES',
    mainEntityOfPage: absoluteUrl(`/blog/${p.slug}`),
    author: { '@type': 'Organization', name: SITE_NAME, url: absoluteUrl('/') },
    publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: absoluteUrl('/brand/logo-reserva360-96.png') } },
    image: absoluteUrl('/og/reserva360-og.png'),
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <JsonLd data={[articleLd, breadcrumbLd([{ name: 'Inicio', path: '/' }, { name: 'Blog', path: '/blog' }, { name: p.title, path: `/blog/${p.slug}` }])]} />
      <MarketingHeader />
      <main id="contenido" className="container mx-auto px-4 py-10 md:px-6 md:py-14">
        <nav aria-label="Ruta de navegación" className="text-sm text-slate-500">
          <ol className="flex flex-wrap items-center gap-1">
            <li><Link href="/" className="hover:text-indigo-700">Inicio</Link></li>
            <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
            <li><Link href="/blog" className="hover:text-indigo-700">Blog</Link></li>
            {cat && <><li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li><li><Link href={`/blog/categoria/${cat.slug}`} className="hover:text-indigo-700">{cat.name}</Link></li></>}
          </ol>
        </nav>

        <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1fr)_300px]">
          <article className="min-w-0 max-w-3xl">
            <header>
              <h1 className="text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">{p.title}</h1>
              <p className="mt-4 text-lg text-slate-600">{p.description}</p>
              <div className="mt-4 flex items-center gap-4 text-sm text-slate-500">
                <time dateTime={p.date}>{formatDate(p.date)}</time>
                <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" aria-hidden="true" />{p.minutes} min de lectura</span>
              </div>
            </header>
            <div className="mt-6">{p.blocks.map((b, i) => <Block key={i} b={b} />)}</div>

            <section className="mt-12 rounded-2xl bg-indigo-50 p-6 md:p-8" aria-labelledby="cta-articulo">
              <h2 id="cta-articulo" className="text-xl font-bold">Pon esto en práctica con Reserva360</h2>
              <p className="mt-2 text-sm text-slate-700">Reservas online 24 h, agenda por profesional y recordatorios automáticos en una sola plataforma.</p>
              <div className="mt-5"><PrimaryCta location={`blog-${p.slug}`} /></div>
              <CtaNote className="mt-3" />
            </section>
          </article>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            {sector && (
              <div className="rounded-2xl border border-slate-200 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Para tu sector</p>
                <Link href={`/${sector.slug}`} className="mt-2 block font-semibold text-indigo-700 hover:underline">{sector.h1}</Link>
                <p className="mt-1 text-sm text-slate-600">{sector.description}</p>
              </div>
            )}
            <div className="rounded-2xl border border-slate-200 p-5">
              <p className="text-sm font-semibold">Prueba Reserva360</p>
              <p className="mt-1 text-sm text-slate-600">Gratis durante el lanzamiento y sin tarjeta.</p>
              <div className="mt-4"><PrimaryCta location={`blog-sidebar-${p.slug}`} label="Crear cuenta gratis" className="w-full !py-2.5 !text-sm" /></div>
            </div>
          </aside>
        </div>

        {more.length > 0 && (
          <section className="mt-16" aria-labelledby="relacionados">
            <h2 id="relacionados" className="text-2xl font-bold">Sigue leyendo</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-3">{more.map((x) => <PostCard key={x.slug} post={x} />)}</div>
          </section>
        )}
      </main>
      <MarketingFooter />
    </div>
  );
}
