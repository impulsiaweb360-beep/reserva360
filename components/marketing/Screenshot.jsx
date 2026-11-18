// Captura real del producto, en WebP con tamaños responsive y carga diferida.
export function BrowserShot({ name, alt, priority = false, caption }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-indigo-900/10">
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-3 py-2" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
        <span className="ml-3 hidden rounded bg-white px-2 py-0.5 text-[11px] text-slate-400 sm:inline">reserva360.es/dashboard</span>
      </div>
      <img
        src={`/screenshots/${name}-1600.webp`}
        srcSet={`/screenshots/${name}-960.webp 960w, /screenshots/${name}-1600.webp 1600w`}
        sizes="(max-width: 1024px) 100vw, 1100px"
        width={1600}
        height={name === 'panel-dashboard' ? 603 : 667}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        className="block h-auto w-full"
      />
      {caption && <figcaption className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">{caption}</figcaption>}
    </figure>
  );
}

export function PhoneShot({ name, alt, className = '', priority = false }) {
  return (
    <div className={`overflow-hidden rounded-[2rem] border-[6px] border-slate-900 bg-white shadow-2xl ${className}`}>
      <img
        src={`/screenshots/${name}-390.webp`}
        width={390}
        height={827}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className="block h-auto w-full"
      />
    </div>
  );
}
