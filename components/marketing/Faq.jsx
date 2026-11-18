import { ChevronDown } from 'lucide-react';

// Acordeón accesible sin JavaScript (details/summary): el contenido está en el HTML para Google.
export default function Faq({ faqs = [], headingLevel = 'h3' }) {
  const H = headingLevel;
  return (
    <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
      {faqs.map((f) => (
        <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
            <H className="text-base font-semibold text-slate-900">{f.q}</H>
            <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
