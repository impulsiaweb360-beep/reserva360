import Link from 'next/link';
import { Clock, ArrowRight } from 'lucide-react';
import { getCategory } from '@/lib/marketing/blog';

export const formatDate = (d) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' });

export function PostCard({ post }) {
  const cat = getCategory(post.category);
  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 transition hover:shadow-lg">
      <div className="flex items-center gap-3 text-xs">
        {cat && <Link href={`/blog/categoria/${cat.slug}`} className="rounded-full bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700 hover:bg-indigo-100">{cat.name}</Link>}
        <span className="inline-flex items-center gap-1 text-slate-500"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{post.minutes} min</span>
      </div>
      <h2 className="mt-4 text-lg font-bold leading-snug">
        <Link href={`/blog/${post.slug}`} className="hover:text-indigo-700">{post.title}</Link>
      </h2>
      <p className="mt-2 flex-1 text-sm text-slate-600">{post.description}</p>
      <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
        <time dateTime={post.date}>{formatDate(post.date)}</time>
        <Link href={`/blog/${post.slug}`} className="inline-flex items-center gap-1 font-semibold text-indigo-700" aria-label={`Leer: ${post.title}`}>
          Leer <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

export function CategoryNav({ categories, active }) {
  return (
    <nav aria-label="Categorías del blog" className="flex flex-wrap gap-2">
      <Link href="/blog" aria-current={!active ? 'page' : undefined}
        className={`rounded-full border px-4 py-1.5 text-sm font-medium ${!active ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300'}`}>
        Todos
      </Link>
      {categories.map((c) => (
        <Link key={c.slug} href={`/blog/categoria/${c.slug}`} aria-current={active === c.slug ? 'page' : undefined}
          className={`rounded-full border px-4 py-1.5 text-sm font-medium ${active === c.slug ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300'}`}>
          {c.name}
        </Link>
      ))}
    </nav>
  );
}
