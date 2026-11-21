'use client';

// Listado de leads: buscador, filtros, ordenación, paginación, exportación e importación CSV
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Search, Download, Upload, ChevronLeft, ChevronRight, ArrowUpDown, Loader2, Link2, BellOff, X } from 'lucide-react';
import { CRM_STAGES, CRM_SECTORS, CRM_SOURCES, sourceLabel } from '@/lib/crm/constants';
import { crm, leadName, contactName, fmtDate, StageBadge, isOverdue } from './shared';
import ImportDialog from './ImportDialog';

const ALL = '__all__';
const EMPTY = { q: '', stage: ALL, sector: ALL, source: ALL, from: '', to: '' };

export default function CrmLeads({ rev, onOpenLead, onError, onChanged }) {
  const [f, setF] = useState(EMPTY);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Búsqueda con pequeña espera para no lanzar una petición por tecla
  useEffect(() => { const t = setTimeout(() => { setF((p) => ({ ...p, q })); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (f.q) p.set('q', f.q);
    for (const k of ['stage', 'sector', 'source']) if (f[k] !== ALL) p.set(k, f[k]);
    if (f.from) p.set('from', f.from);
    if (f.to) p.set('to', f.to);
    return p;
  }, [f]);

  useEffect(() => {
    const p = new URLSearchParams(qs);
    p.set('page', String(page)); p.set('pageSize', '25'); p.set('sort', sort.key); p.set('dir', sort.dir);
    setLoading(true);
    crm(`leads?${p}`).then(setData).catch(onError).finally(() => setLoading(false));
  }, [qs, page, sort, rev, onError]);

  const set = (k) => (v) => { setF((p) => ({ ...p, [k]: v })); setPage(1); };
  const toggleSort = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const filtered = f.q || f.from || f.to || ['stage', 'sector', 'source'].some((k) => f[k] !== ALL);

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await fetch(`/api/admin/crm/export?${qs}`, { cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo exportar');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `leads-reserva360-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      toast.success(`${res.headers.get('X-Export-Count') || ''} leads exportados (registrado en auditoría)`);
    } catch (e) { toast.error(e.message); } finally { setExporting(false); }
  }

  const SortHead = ({ k, children, className = '' }) => (
    <TableHead className={className}>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(k)} data-testid={`crm-sort-${k}`}>
        {children}<ArrowUpDown className={`h-3 w-3 ${sort.key === k ? 'text-foreground' : 'opacity-40'}`} />
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-3 pt-2" data-testid="crm-leads">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-0 flex-1 basis-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar por negocio, contacto, email, teléfono o ciudad" value={q} onChange={(e) => setQ(e.target.value)} data-testid="crm-search" />
            </div>
            <Button variant="outline" onClick={() => setImportOpen(true)} data-testid="crm-import-open"><Upload className="mr-2 h-4 w-4" />Importar CSV</Button>
            <Button variant="outline" onClick={exportCsv} disabled={exporting} data-testid="crm-export">{exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Exportar{filtered ? ' filtrados' : ''}</Button>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <Select value={f.stage} onValueChange={set('stage')}><SelectTrigger data-testid="crm-filter-stage"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Todas las etapas</SelectItem>{CRM_STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent></Select>
            <Select value={f.sector} onValueChange={set('sector')}><SelectTrigger data-testid="crm-filter-sector"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Todos los sectores</SelectItem>{CRM_SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            <Select value={f.source} onValueChange={set('source')}><SelectTrigger data-testid="crm-filter-source"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Todas las fuentes</SelectItem>{CRM_SOURCES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent></Select>
            <Input type="date" value={f.from} onChange={(e) => set('from')(e.target.value)} title="Creado desde" data-testid="crm-filter-from" />
            <Input type="date" value={f.to} onChange={(e) => set('to')(e.target.value)} title="Creado hasta" data-testid="crm-filter-to" />
          </div>
          {filtered && <Button size="sm" variant="ghost" onClick={() => { setF(EMPTY); setQ(''); setPage(1); }}><X className="mr-1 h-3.5 w-3.5" />Quitar filtros</Button>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table data-testid="crm-leads-table">
              <TableHeader>
                <TableRow>
                  <SortHead k="business_name">Negocio / contacto</SortHead>
                  <TableHead>Sector</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Ciudad / provincia</TableHead>
                  <TableHead>Fuente</TableHead>
                  <SortHead k="stage">Estado</SortHead>
                  <SortHead k="created_at">Creado</SortHead>
                  <SortHead k="last_contact_at">Último contacto</SortHead>
                  <SortHead k="next_contact_at">Próxima tarea</SortHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data && <TableRow><TableCell colSpan={10} className="h-24 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>}
                {data?.rows.length === 0 && <TableRow><TableCell colSpan={10} className="h-24 text-center text-sm text-muted-foreground">{filtered ? 'Ningún lead coincide con los filtros.' : 'Todavía no hay leads.'}</TableCell></TableRow>}
                {data?.rows.map((l) => (
                  <TableRow key={l.id} className="cursor-pointer" onClick={() => onOpenLead(l.id)} data-testid={`crm-lead-row-${l.id}`}>
                    <TableCell className="min-w-[180px]">
                      <p className="flex items-center gap-1.5 font-medium">{leadName(l)}{l.linked_tenant_id && <Link2 className="h-3 w-3 text-emerald-600" />}{l.opted_out && <BellOff className="h-3 w-3 text-zinc-500" />}</p>
                      <p className="text-xs text-muted-foreground">{contactName(l) || '—'}</p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{l.sector || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{l.phone || '—'}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">{l.email || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{[l.city, l.province].filter(Boolean).join(' · ') || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{sourceLabel(l.source)}</TableCell>
                    <TableCell><StageBadge stage={l.stage} /></TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{fmtDate(l.created_at)}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{fmtDate(l.last_contact_at)}</TableCell>
                    <TableCell className="min-w-[150px] text-xs">
                      {l.next_task ? (
                        <span className={isOverdue(l.next_task.due_at) ? 'font-medium text-rose-600' : ''}>{l.next_task.title}<br /><span className="text-muted-foreground">{fmtDate(l.next_task.due_at)}</span></span>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between gap-2 border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground" data-testid="crm-leads-total">{data ? `${data.total} leads` : ''}{loading && data ? ' · cargando…' : ''}</span>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} data-testid="crm-page-prev"><ChevronLeft className="h-4 w-4" /></Button>
              <span className="tabular-nums">{page} / {pages}</span>
              <Button size="icon" variant="outline" className="h-8 w-8" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} data-testid="crm-page-next"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onDone={onChanged} />
    </div>
  );
}
