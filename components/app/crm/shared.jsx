'use client';

// Piezas compartidas del CRM Comercial (Super Admin)
import { Badge } from '@/components/ui/badge';
import { stageMeta, priorityMeta } from '@/lib/crm/constants';

export async function crm(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api/admin/crm/${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Error ${res.status}`);
    err.status = res.status; err.data = data;
    throw err;
  }
  return data;
}

export const leadName = (l) => l?.business_name || [l?.first_name, l?.last_name].filter(Boolean).join(' ') || l?.email || 'Lead sin nombre';
export const contactName = (l) => [l?.first_name, l?.last_name].filter(Boolean).join(' ');
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
export const isOverdue = (d) => Boolean(d) && new Date(d).getTime() < Date.now();

// <input type="datetime-local"> ↔ ISO
export const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

export function StageBadge({ stage, className = '' }) {
  const m = stageMeta(stage);
  return <Badge variant="outline" className={`${m.color} whitespace-nowrap font-medium ${className}`}>{m.label}</Badge>;
}

export function PriorityBadge({ priority }) {
  const m = priorityMeta(priority);
  return <Badge variant="outline" className={`${m.color} font-medium`}>{m.label}</Badge>;
}

export function Stat({ label, value, hint, icon: Icon, tone = 'text-foreground', testid }) {
  return (
    <div className="rounded-xl border bg-card p-4" data-testid={testid}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
