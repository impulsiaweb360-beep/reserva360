'use client';

// Pipeline comercial tipo Kanban: arrastrar tarjetas (escritorio) o menú «Mover a» (móvil)
import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Loader2, Search, MoreVertical, Link2, BellOff, GripVertical, Info } from 'lucide-react';
import { CRM_STAGES, stageLabel } from '@/lib/crm/constants';
import { crm, leadName, contactName } from './shared';

export default function CrmPipeline({ rev, onOpenLead, onError, onChanged }) {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [over, setOver] = useState(null);
  const [moving, setMoving] = useState(null);

  useEffect(() => { crm('pipeline').then((r) => setRows(r.rows)).catch(onError); }, [rev, onError]);
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows || []).filter((l) => !s || [l.business_name, l.first_name, l.last_name, l.email, l.city].some((v) => String(v || '').toLowerCase().includes(s)));
  }, [rows, q]);

  async function move(lead, stage) {
    if (!lead || lead.stage === stage) return;
    if (lead.anonymized_at) { toast.error('Lead anonimizado: no se puede mover'); return; }
    const prev = rows;
    setMoving(lead.id);
    setRows((rs) => rs.map((r) => (r.id === lead.id ? { ...r, stage } : r))); // actualización optimista
    try {
      await crm(`leads/${lead.id}/stage`, { method: 'POST', body: { stage } });
      toast.success(`${leadName(lead)} → ${stageLabel(stage)}`);
      onChanged?.();
    } catch (e) { setRows(prev); toast.error(e.message); } finally { setMoving(null); }
  }

  if (!rows) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3 pt-2" data-testid="crm-pipeline">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-60 sm:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Filtrar tarjetas" value={q} onChange={(e) => setQ(e.target.value)} data-testid="crm-pipeline-search" />
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Info className="h-3.5 w-3.5" />Herramienta de seguimiento: mover una tarjeta nunca cambia planes, suscripciones ni pagos.</p>
      </div>
      <div className="-mx-1 overflow-x-auto pb-3">
        <div className="flex min-w-max gap-3 px-1">
          {CRM_STAGES.map((st) => {
            const items = visible.filter((l) => l.stage === st.id);
            return (
              <div
                key={st.id}
                className={`flex w-64 shrink-0 flex-col rounded-xl border bg-muted/30 transition-colors ${over === st.id ? 'border-primary bg-primary/5' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setOver(st.id); }}
                onDragLeave={() => setOver((o) => (o === st.id ? null : o))}
                onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData('text/plain'); move(rows.find((r) => r.id === id), st.id); }}
                data-testid={`crm-col-${st.id}`}
              >
                <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm font-semibold"><span className={`h-2 w-2 rounded-full ${st.dot}`} />{st.label}</span>
                  <span className="rounded-full bg-background px-2 text-xs tabular-nums text-muted-foreground">{items.length}</span>
                </div>
                <div className="flex max-h-[62vh] min-h-[120px] flex-col gap-2 overflow-y-auto p-2">
                  {items.slice(0, 200).map((l) => (
                    <div
                      key={l.id}
                      draggable={!l.anonymized_at}
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', l.id); e.dataTransfer.effectAllowed = 'move'; }}
                      className={`group rounded-lg border bg-card p-2.5 shadow-sm ${moving === l.id ? 'opacity-50' : ''} ${l.anonymized_at ? '' : 'cursor-grab active:cursor-grabbing'}`}
                      data-testid={`crm-card-${l.id}`}
                    >
                      <div className="flex items-start gap-1">
                        <GripVertical className="mt-0.5 hidden h-4 w-4 shrink-0 text-muted-foreground/50 md:block" />
                        <button className="min-w-0 flex-1 text-left" onClick={() => onOpenLead(l.id)}>
                          <p className="flex items-center gap-1 truncate text-sm font-medium">{leadName(l)}{l.linked_tenant_id && <Link2 className="h-3 w-3 shrink-0 text-emerald-600" />}{l.opted_out && <BellOff className="h-3 w-3 shrink-0 text-zinc-500" />}</p>
                          <p className="truncate text-xs text-muted-foreground">{[contactName(l), l.city].filter(Boolean).join(' · ') || l.email || '—'}</p>
                        </button>
                        {!l.anonymized_at && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" data-testid={`crm-card-menu-${l.id}`}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Mover a</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {CRM_STAGES.filter((s) => s.id !== l.stage).map((s) => (
                                <DropdownMenuItem key={s.id} onClick={() => move(l, s.id)} data-testid={`crm-move-${l.id}-${s.id}`}><span className={`mr-2 h-2 w-2 rounded-full ${s.dot}`} />{s.label}</DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  ))}
                  {items.length > 200 && <p className="px-1 text-xs text-muted-foreground">+{items.length - 200} más (usa el listado para verlos)</p>}
                  {items.length === 0 && <p className="px-1 py-4 text-center text-xs text-muted-foreground">Suelta aquí</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
