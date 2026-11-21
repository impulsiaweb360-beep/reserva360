'use client';

// Ficha individual del lead: datos, historial cronológico, tareas, vinculación con negocio real y privacidad
import { useCallback, useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Loader2, Pencil, Phone, Mail, Globe, MapPin, Building2, Link2, Unlink, Search, ShieldCheck, Download, CheckCircle2, XCircle,
  PhoneCall, Users, Presentation, StickyNote, ArrowRightLeft, UserPlus, Trophy, ListTodo, FileUp, Lock, Info, Wrench,
} from 'lucide-react';
import {
  CRM_STAGES, ACTIVITY_TYPES, MANUAL_ACTIVITY_IDS, TASK_TYPES, PRIVACY_TYPES, activityLabel, sourceLabel, legalLabel,
  privacyLabel, taskTypeLabel, stageLabel, CLIENT_STAGES,
} from '@/lib/crm/constants';
import { crm, leadName, contactName, fmtDate, fmtDateTime, isOverdue, StageBadge, PriorityBadge, toLocalInput, fromLocalInput } from './shared';
import LeadForm from './LeadForm';

const ACT_ICON = { call: PhoneCall, email: Mail, meeting: Users, demo: Presentation, note: StickyNote, stage_change: ArrowRightLeft, signup: UserPlus, conversion: Trophy, task: ListTodo, import: FileUp, link: Link2, privacy: ShieldCheck, correction: Wrench, system: Info };
const PLAN_NAME = { plan_free: 'Free', plan_pro: 'Pro', plan_business: 'Business' };

function Row({ icon: Icon, children }) {
  if (!children) return null;
  return <div className="flex items-start gap-2 text-sm"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 break-words">{children}</span></div>;
}
function KV({ k, v }) {
  return <div className="rounded-lg border bg-muted/20 px-3 py-2"><p className="text-[11px] text-muted-foreground">{k}</p><p className="text-sm font-medium break-words">{v || '—'}</p></div>;
}

export default function LeadDetail({ leadId, open, onOpenChange, onChanged }) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState('timeline');

  const load = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    try { setD(await crm(`leads/${leadId}`)); } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  }, [leadId]);
  useEffect(() => { if (open && leadId) { setD(null); setTab('timeline'); load(); } }, [open, leadId, load]);
  const changed = async () => { await load(); onChanged?.(); };

  const lead = d?.lead;
  const locked = Boolean(lead?.anonymized_at);

  async function moveStage(stage) {
    try { setD(await crm(`leads/${lead.id}/stage`, { method: 'POST', body: { stage } })); toast.success(`Etapa: ${stageLabel(stage)}`); onChanged?.(); }
    catch (e) { toast.error(e.message); }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-2xl" data-testid="crm-lead-detail">
        {!lead ? (
          <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <SheetHeader className="space-y-3 border-b p-5 text-left">
              <div className="flex flex-wrap items-start justify-between gap-3 pr-6">
                <div className="min-w-0">
                  <SheetTitle className="truncate text-xl" data-testid="crm-lead-title">{leadName(lead)}</SheetTitle>
                  <SheetDescription>{contactName(lead) || 'Sin persona de contacto'}{lead.sector ? ` · ${lead.sector}` : ''}</SheetDescription>
                </div>
                {!locked && <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} data-testid="crm-lead-edit"><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar</Button>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StageBadge stage={lead.stage} />
                {lead.opted_out && <Badge variant="outline" className="border-zinc-300 bg-zinc-100 text-zinc-800">No desea comunicaciones</Badge>}
                {lead.linked_tenant_id && <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800"><Link2 className="mr-1 h-3 w-3" />Vinculado</Badge>}
                {locked && <Badge variant="outline" className="border-zinc-300 bg-zinc-100"><Lock className="mr-1 h-3 w-3" />Anonimizado</Badge>}
                {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              {!locked && (
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Mover a</Label>
                  <Select value={lead.stage} onValueChange={moveStage}>
                    <SelectTrigger className="h-8 w-56" data-testid="crm-lead-stage-select"><SelectValue /></SelectTrigger>
                    <SelectContent>{CRM_STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                  {CLIENT_STAGES.includes(lead.stage) && lead.linked_tenant_id && <span className="text-[11px] text-muted-foreground">Se sincroniza con el plan real</span>}
                </div>
              )}
            </SheetHeader>

            <div className="space-y-4 p-5">
              <div className="grid gap-2 sm:grid-cols-2">
                <Row icon={Mail}>{lead.email}</Row>
                <Row icon={Phone}>{lead.phone}</Row>
                <Row icon={Globe}>{lead.website}</Row>
                <Row icon={MapPin}>{[lead.address, lead.city, lead.province].filter(Boolean).join(', ')}</Row>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <KV k="Fuente" v={sourceLabel(lead.source)} />
                <KV k="Último contacto" v={fmtDate(lead.last_contact_at)} />
                <KV k="Próximo contacto" v={fmtDate(lead.next_contact_at)} />
                <KV k="Creado" v={fmtDate(lead.created_at)} />
              </div>

              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="h-auto w-full flex-wrap justify-start">
                  <TabsTrigger value="timeline" data-testid="crm-tab-timeline">Historial</TabsTrigger>
                  <TabsTrigger value="tasks" data-testid="crm-tab-tasks">Tareas ({d.tasks.filter((t) => t.status === 'pending').length})</TabsTrigger>
                  <TabsTrigger value="info" data-testid="crm-tab-info">Ficha</TabsTrigger>
                  <TabsTrigger value="link" data-testid="crm-tab-link">Vinculación</TabsTrigger>
                  <TabsTrigger value="privacy" data-testid="crm-tab-privacy">Privacidad</TabsTrigger>
                </TabsList>
                <TabsContent value="timeline"><Timeline d={d} locked={locked} onAdded={changed} /></TabsContent>
                <TabsContent value="tasks"><LeadTasks d={d} locked={locked} onChanged={changed} /></TabsContent>
                <TabsContent value="info"><LeadInfo d={d} /></TabsContent>
                <TabsContent value="link"><LinkPanel d={d} locked={locked} onChanged={(nd) => { if (nd?.lead) setD(nd); onChanged?.(); }} /></TabsContent>
                <TabsContent value="privacy"><PrivacyPanel d={d} onChanged={changed} /></TabsContent>
              </Tabs>
            </div>
            <LeadForm open={editOpen} onOpenChange={setEditOpen} lead={lead} onSaved={changed} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ------------------------------------------------------------ historial
function Timeline({ d, locked, onAdded }) {
  const [type, setType] = useState('call');
  const [desc, setDesc] = useState('');
  const [when, setWhen] = useState('');
  const [saving, setSaving] = useState(false);
  async function add() {
    setSaving(true);
    try {
      await crm(`leads/${d.lead.id}/activities`, { method: 'POST', body: { type, description: desc, occurred_at: when ? fromLocalInput(when) : null } });
      setDesc(''); setWhen(''); toast.success('Actividad registrada'); await onAdded();
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  }
  return (
    <div className="space-y-4 pt-2">
      {!locked && (
        <div className="space-y-2 rounded-xl border p-3" data-testid="crm-activity-form">
          <div className="grid gap-2 sm:grid-cols-2">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger data-testid="crm-activity-type"><SelectValue /></SelectTrigger>
              <SelectContent>{ACTIVITY_TYPES.filter((a) => MANUAL_ACTIVITY_IDS.includes(a.id)).map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} max={toLocalInput(new Date().toISOString())} title="Fecha y hora (vacío = ahora)" />
          </div>
          <Textarea rows={2} placeholder="¿Qué ha pasado? Ej.: llamada, le interesa la agenda online y pide demo la semana que viene" value={desc} onChange={(e) => setDesc(e.target.value)} data-testid="crm-activity-desc" />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">El historial no se puede editar; para corregir, añade una «Corrección».</p>
            <Button size="sm" onClick={add} disabled={saving || !desc.trim()} data-testid="crm-activity-save">{saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Registrar</Button>
          </div>
        </div>
      )}
      <ol className="relative space-y-3 border-l pl-5" data-testid="crm-timeline">
        {d.activities.length === 0 && <p className="text-sm text-muted-foreground">Sin actividad todavía.</p>}
        {d.activities.map((a) => {
          const Icon = ACT_ICON[a.type] || Info;
          return (
            <li key={a.id} className="relative">
              <span className="absolute -left-[29px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full border bg-background"><Icon className="h-3.5 w-3.5 text-muted-foreground" /></span>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm font-medium">{activityLabel(a.type)}</p>
                <p className="text-[11px] text-muted-foreground">{fmtDateTime(a.occurred_at)}{a.created_by ? ` · ${d.actors[a.created_by] || 'Admin'}` : ' · Sistema'}</p>
              </div>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{a.description}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ------------------------------------------------------------ tareas del lead
function LeadTasks({ d, locked, onChanged }) {
  const [f, setF] = useState({ title: '', task_type: 'follow_up', priority: 'medium', due_at: '', description: '' });
  const [saving, setSaving] = useState(false);
  async function create() {
    setSaving(true);
    try {
      await crm('tasks', { method: 'POST', body: { ...f, due_at: fromLocalInput(f.due_at), lead_id: d.lead.id } });
      setF({ title: '', task_type: 'follow_up', priority: 'medium', due_at: '', description: '' });
      toast.success('Tarea creada'); await onChanged();
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  }
  async function setStatus(t, status) {
    try { await crm(`tasks/${t.id}`, { method: 'PATCH', body: { status } }); toast.success(status === 'completed' ? 'Tarea completada' : 'Tarea cancelada'); await onChanged(); }
    catch (e) { toast.error(e.message); }
  }
  return (
    <div className="space-y-4 pt-2">
      {!locked && (
        <div className="space-y-2 rounded-xl border p-3">
          <Input placeholder="Ej.: Llamar para cerrar la demo" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} data-testid="crm-lead-task-title" />
          <div className="grid gap-2 sm:grid-cols-3">
            <Select value={f.task_type} onValueChange={(v) => setF({ ...f, task_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TASK_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent></Select>
            <Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="high">Prioridad alta</SelectItem><SelectItem value="medium">Prioridad media</SelectItem><SelectItem value="low">Prioridad baja</SelectItem></SelectContent></Select>
            <Input type="datetime-local" value={f.due_at} onChange={(e) => setF({ ...f, due_at: e.target.value })} data-testid="crm-lead-task-due" />
          </div>
          <div className="flex justify-end"><Button size="sm" onClick={create} disabled={saving || !f.title.trim()} data-testid="crm-lead-task-save">Añadir tarea</Button></div>
        </div>
      )}
      <div className="space-y-2">
        {d.tasks.length === 0 && <p className="text-sm text-muted-foreground">Sin tareas.</p>}
        {d.tasks.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3" data-testid={`crm-lead-task-${t.id}`}>
            <div className="min-w-0">
              <p className={`text-sm font-medium ${t.status !== 'pending' ? 'text-muted-foreground line-through' : ''}`}>{t.title}</p>
              <p className={`text-xs ${t.status === 'pending' && isOverdue(t.due_at) ? 'font-medium text-rose-600' : 'text-muted-foreground'}`}>
                {taskTypeLabel(t.task_type)} · {t.due_at ? `vence ${fmtDateTime(t.due_at)}` : 'sin fecha'}{t.status === 'pending' && isOverdue(t.due_at) ? ' · VENCIDA' : ''}
                {t.status === 'completed' && ' · Completada'}{t.status === 'cancelled' && ' · Cancelada'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <PriorityBadge priority={t.priority} />
              {t.status === 'pending' && !locked && (
                <>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-700" title="Completar" onClick={() => setStatus(t, 'completed')}><CheckCircle2 className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600" title="Cancelar" onClick={() => setStatus(t, 'cancelled')}><XCircle className="h-4 w-4" /></Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ ficha completa
function LeadInfo({ d }) {
  const l = d.lead;
  const interest = { low: 'Bajo', medium: 'Medio', high: 'Alto' }[l.interest_level];
  const plan = { free: 'FREE', pro: 'PRO', business: 'Business' }[l.suggested_plan];
  return (
    <div className="space-y-4 pt-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <KV k="Nombre" v={l.first_name} /><KV k="Apellidos" v={l.last_name} />
        <KV k="Negocio" v={l.business_name} /><KV k="Sector" v={l.sector} />
        <KV k="Detalle de la fuente" v={l.source_detail} /><KV k="Nº aproximado de empleados" v={l.employees_estimate ?? null} />
        <KV k="Interés en Reserva360" v={interest} /><KV k="Plan que podría necesitar" v={plan} />
      </div>
      <KV k="Necesidades del negocio" v={l.needs} />
      <KV k="Observaciones internas" v={l.notes} />
      <div>
        <p className="mb-2 text-sm font-semibold">Historial de etapas</p>
        <div className="space-y-1.5" data-testid="crm-stage-history">
          {d.history.map((h) => (
            <div key={h.id} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">{fmtDateTime(h.created_at)}</span>
              {h.from_stage ? <StageBadge stage={h.from_stage} /> : <span className="text-muted-foreground">Alta</span>}
              <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
              <StageBadge stage={h.to_stage} />
              <span className="text-muted-foreground">{{ manual: 'manual', sync: 'sincronizado', import: 'importación', create: 'alta', privacy: 'privacidad' }[h.origin]}{h.changed_by ? ` · ${d.actors[h.changed_by] || 'Admin'}` : ''}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ vinculación con usuario/negocio reales
function LinkPanel({ d, locked, onChanged }) {
  const [cands, setCands] = useState(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const l = d.lead;

  useEffect(() => {
    if (l.linked_tenant_id || locked) return;
    crm(`leads/${l.id}/candidates`).then((r) => setCands(r.candidates)).catch(() => setCands([]));
  }, [l.id, l.linked_tenant_id, locked]);

  async function search() {
    try { setResults((await crm(`tenants?q=${encodeURIComponent(q)}`)).rows); } catch (e) { toast.error(e.message); }
  }
  async function link(tenantId, userId) {
    setBusy(true);
    try { const nd = await crm(`leads/${l.id}/link`, { method: 'POST', body: { tenantId, userId: userId || null } }); toast.success('Lead vinculado con el negocio real'); onChanged(nd); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }
  async function unlink() {
    setBusy(true);
    try { const nd = await crm(`leads/${l.id}/unlink`, { method: 'POST', body: { reason } }); toast.success('Vínculo eliminado'); setReason(''); onChanged(nd); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }

  if (d.tenant) {
    return (
      <div className="space-y-3 pt-2" data-testid="crm-linked-tenant">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold"><Building2 className="h-4 w-4" />{d.tenant.name}</p>
          <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            <span>Usuario: <b>{d.user?.email || '—'}</b></span>
            <span>Registrado: <b>{fmtDate(d.tenant.created_at)}</b></span>
            <span>Plan real: <b>{PLAN_NAME[d.tenant.plan_id] || d.tenant.plan_id}</b>{d.tenant.has_subscription ? ` · suscripción ${d.tenant.subscription_status}` : ' · sin suscripción de pago'}</span>
            <span>Etapa según datos reales: <b>{stageLabel(d.tenant.real_stage)}</b></span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Solo lectura: el CRM nunca cambia el plan, la suscripción ni los pagos del negocio.</p>
        </div>
        {!locked && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1"><Label className="text-xs">Motivo para desvincular</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Vinculado por error…" /></div>
            <Button variant="outline" onClick={unlink} disabled={busy || !reason.trim()}><Unlink className="mr-1.5 h-4 w-4" />Desvincular</Button>
          </div>
        )}
      </div>
    );
  }
  if (locked) return <p className="pt-2 text-sm text-muted-foreground">Lead anonimizado: no se puede vincular.</p>;
  const Cand = ({ c }) => (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3" data-testid={`crm-candidate-${c.tenantId}`}>
      <div className="min-w-0">
        <p className="text-sm font-medium">{c.name}</p>
        <p className="text-xs text-muted-foreground">{c.userEmail || c.email || '—'} · {stageLabel(c.realStage)}{c.reasons ? ` · coincide: ${c.reasons.join(', ')}` : ''}</p>
        {c.linkedLeadId && <p className="text-xs text-amber-700">Ya vinculado a otro lead</p>}
      </div>
      <Button size="sm" onClick={() => link(c.tenantId, c.userId || c.owners?.[0]?.id)} disabled={busy || Boolean(c.linkedLeadId)} data-testid={`crm-link-${c.tenantId}`}><Link2 className="mr-1.5 h-3.5 w-3.5" />Vincular</Button>
    </div>
  );
  return (
    <div className="space-y-4 pt-2">
      <div>
        <p className="mb-2 text-sm font-semibold">Coincidencias detectadas</p>
        {cands === null ? <Loader2 className="h-4 w-4 animate-spin" /> : cands.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay cuentas con el mismo email o teléfono.</p>
        ) : (
          <div className="space-y-2">
            {cands.length > 1 && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Hay varias coincidencias: revisa cuál es la correcta. Nada se vincula automáticamente.</p>}
            {cands.map((c) => <Cand key={c.tenantId} c={c} />)}
          </div>
        )}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">Buscar negocio registrado</p>
        <div className="flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Nombre, email o slug" data-testid="crm-tenant-search" />
          <Button variant="outline" onClick={search} disabled={q.trim().length < 2}><Search className="h-4 w-4" /></Button>
        </div>
        {results.map((c) => <Cand key={c.tenantId} c={{ ...c, userEmail: c.owners?.[0]?.email }} />)}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ privacidad
function PrivacyPanel({ d, onChanged }) {
  const l = d.lead;
  const [type, setType] = useState('access');
  const [details, setDetails] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  async function createReq() {
    setBusy(true);
    try { await crm(`leads/${l.id}/privacy`, { method: 'POST', body: { request_type: type, details } }); setDetails(''); toast.success('Solicitud registrada'); await onChanged(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }
  async function resolve(req, status) {
    setBusy(true);
    try { await crm(`privacy/${req.id}/resolve`, { method: 'POST', body: { status } }); toast.success(status === 'completed' ? 'Solicitud atendida' : 'Solicitud rechazada'); setConfirm(null); await onChanged(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }
  async function downloadData() {
    try {
      const data = await crm(`leads/${l.id}/data`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `datos-lead-${l.id.slice(0, 8)}.json`; a.click();
      toast.success('Datos exportados (queda registrado en auditoría)');
    } catch (e) { toast.error(e.message); }
  }
  return (
    <div className="space-y-4 pt-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <KV k="Base jurídica" v={legalLabel(l.legal_basis)} />
        <KV k="Origen documentado de los datos" v={l.data_origin} />
        <KV k="Consentimiento" v={l.consent_at ? `${fmtDateTime(l.consent_at)} · ${l.consent_source || ''}` : 'No consta'} />
        <KV k="Oposición a comunicaciones" v={l.opted_out ? `Sí, desde ${fmtDate(l.opted_out_at)}` : 'No'} />
        <KV k="Preferencias" v={[l.comm_email && 'Email', l.comm_phone && 'Teléfono', l.comm_whatsapp && 'WhatsApp'].filter(Boolean).join(', ') || 'Ninguna autorizada'} />
        <KV k="Anonimizado" v={l.anonymized_at ? fmtDateTime(l.anonymized_at) : 'No'} />
      </div>
      {!l.anonymized_at && <Button variant="outline" size="sm" onClick={downloadData} data-testid="crm-privacy-export"><Download className="mr-1.5 h-3.5 w-3.5" />Descargar sus datos (derecho de acceso)</Button>}

      {!l.anonymized_at && (
        <div className="space-y-2 rounded-xl border p-3">
          <p className="text-sm font-semibold">Registrar solicitud RGPD</p>
          <Select value={type} onValueChange={setType}><SelectTrigger data-testid="crm-privacy-type"><SelectValue /></SelectTrigger><SelectContent>{PRIVACY_TYPES.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent></Select>
          <Textarea rows={2} placeholder="Cómo y cuándo lo pidió (email, llamada…)" value={details} onChange={(e) => setDetails(e.target.value)} />
          <div className="flex justify-end"><Button size="sm" onClick={createReq} disabled={busy} data-testid="crm-privacy-create">Registrar solicitud</Button></div>
        </div>
      )}
      <div className="space-y-2" data-testid="crm-privacy-requests">
        {d.privacy.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{privacyLabel(r.request_type)}</p>
              <p className="text-xs text-muted-foreground">{fmtDateTime(r.requested_at)} · {r.status === 'open' ? 'Pendiente' : r.status === 'completed' ? `Atendida ${fmtDate(r.resolved_at)}` : 'Rechazada'}</p>
            </div>
            {r.status === 'open' && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => resolve(r, 'rejected')} disabled={busy}>Rechazar</Button>
                <Button size="sm" onClick={() => (r.request_type === 'erasure' ? setConfirm(r) : resolve(r, 'completed'))} disabled={busy} data-testid={`crm-privacy-resolve-${r.request_type}`}>Marcar atendida</Button>
              </div>
            )}
          </div>
        ))}
      </div>
      <AlertDialog open={Boolean(confirm)} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anonimizar este lead?</AlertDialogTitle>
            <AlertDialogDescription>Se borrarán sus datos personales y los textos de su historial. Su email y teléfono quedarán en la lista de no contactar para que no se vuelva a importar. No se puede deshacer. Su cuenta de Reserva360, si la tiene, no se toca.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => resolve(confirm, 'completed')} className="bg-rose-600 hover:bg-rose-700" data-testid="crm-privacy-confirm-erasure">Anonimizar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
