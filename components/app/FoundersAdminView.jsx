'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Rocket, Search, Save, CheckCircle2, Circle, ShieldAlert, History } from 'lucide-react';
import { localParts, localToUtc } from '@/lib/tz';
import { FOUNDER_STATUS } from '@/components/app/FounderBenefitView';

const TZ = 'Europe/Madrid';
const fdate = (d) => (d ? new Date(d).toLocaleString('es-ES', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const PLAN = { plan_free: 'Free', plan_pro: 'Pro', plan_business: 'Business' };
const REQ_LABELS = {
  account_before_launch: 'Cuenta creada antes del lanzamiento',
  has_owner: 'Negocio con propietario',
  business_data: 'Datos del negocio (nombre, teléfono, dirección)',
  services: 'Al menos un servicio activo',
  business_hours: 'Horario de apertura',
  availability: 'Al menos un profesional activo',
};
const ACTION_LABELS = {
  'founder.reserved': 'Pago con descuento iniciado',
  'founder.released': 'Pago no completado (reserva liberada)',
  'founder.activated': 'Descuento activado',
  'founder.cycle_paid': 'Ciclo pagado contabilizado',
  'founder.plan_changed': 'Cambio de plan durante la promoción',
  'founder.cancelled': 'Cancelado durante la promoción (descuento perdido)',
  'founder.frozen': 'Elegibilidad congelada en el lanzamiento',
  'founder.discount_stripped': 'Descuento retirado de una suscripción no autorizada',
  'founder.admin_set_eligible': 'Admin: marcado como elegible',
  'founder.admin_set_not_eligible': 'Admin: marcado como no elegible',
  'founder.admin_revoke': 'Admin: beneficio revocado',
  'founder.admin_blocked': 'Admin: intento de duplicar el beneficio BLOQUEADO',
  'founder.program_updated': 'Configuración del programa modificada',
  'subscription.started': 'Alta de suscripción',
  'subscription.restarted': 'Recontratación',
  'subscription.plan_changed': 'Cambio de plan',
  'subscription.cancel_scheduled': 'Cancelación programada',
  'subscription.cancel_reverted': 'Cancelación anulada',
  'subscription.ended': 'Suscripción finalizada',
};

const toInput = (iso) => {
  if (!iso) return '';
  const { dateStr, minutes } = localParts(iso, TZ);
  return `${dateStr}T${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};
const fromInput = (v) => {
  if (!v) return null;
  const [d, t] = v.split('T');
  const [h, m] = (t || '00:00').split(':').map(Number);
  return localToUtc(d, h * 60 + m, TZ).toISOString();
};

function metaText(e) {
  const m = e.metadata || {};
  const bits = [];
  if (m.plan || m.to_plan) bits.push(`plan ${PLAN[m.to_plan || m.plan] || m.to_plan || m.plan}`);
  if (m.from_plan) bits.push(`antes ${PLAN[m.from_plan] || m.from_plan}`);
  if (m.interval || m.to_interval) bits.push(m.to_interval || m.interval);
  if (m.amount != null) bits.push(`${m.amount} €`);
  if (m.cycles_used != null) bits.push(`ciclos ${m.cycles_used}`);
  if (m.eligibility) bits.push(m.eligibility);
  if (m.reason && typeof m.reason === 'string' && !['subscription_create', 'subscription_cycle', 'subscription_update'].includes(m.reason)) bits.push(`motivo: ${m.reason}`);
  return bits.join(' · ');
}

export default function FoundersAdminView() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState(null);
  const [reason, setReason] = useState('');
  const [acting, setActing] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  const load = async () => {
    const r = await fetch('/api/admin/founders');
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setData({ error: j.error || 'Error' }); return; }
    setData(j);
    if (j.program) setForm({ launchAt: toInput(j.program.launch_at), status: j.program.status, newEligibilityEnabled: j.program.new_eligibility_enabled });
  };
  useEffect(() => { load(); }, []);

  const rows = data?.rows || [];
  const counts = useMemo(() => ({
    all: rows.filter((r) => r.registeredBeforeLaunch).length,
    eligible: rows.filter((r) => r.status === 'eligible').length,
    not_eligible: rows.filter((r) => r.status === 'not_eligible').length,
    pending: rows.filter((r) => r.status === 'pending').length,
    active: rows.filter((r) => r.status === 'active').length,
    finished: rows.filter((r) => r.status === 'finished').length,
  }), [rows]);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows
      .filter((r) => (filter === 'all' ? r.registeredBeforeLaunch : r.status === filter))
      .filter((r) => !s || [r.name, r.tenantId, r.slug, r.email, ...r.owners.map((o) => `${o.email} ${o.name}`)].join(' ').toLowerCase().includes(s));
  }, [rows, filter, q]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch('/api/admin/founders', {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ launchAt: fromInput(form.launchAt), status: form.status, newEligibilityEnabled: form.newEligibilityEnabled }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'No se pudo guardar');
      toast.success('Configuración del programa guardada');
      await load();
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  const openDetail = async (row) => {
    setReason('');
    setDetail({ row, loading: true });
    const r = await fetch(`/api/admin/founders/${row.tenantId}`);
    const j = await r.json().catch(() => ({}));
    setDetail({ row, ...j, loading: false });
  };

  const act = async (action) => {
    setActing(true);
    try {
      const r = await fetch(`/api/admin/founders/${detail.row.tenantId}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, reason }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Operación bloqueada');
      if (j.warning) toast.warning(j.warning); else toast.success('Corrección registrada en auditoría');
      await load();
      await openDetail(detail.row);
    } catch (e) { toast.error(e.message); await openDetail(detail.row); } finally { setActing(false); }
  };

  if (!data) return <Card><CardContent className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando programa…</CardContent></Card>;
  if (data.error) return <Card><CardContent className="p-6 text-sm text-rose-600">{data.error}</CardContent></Card>;
  if (data.migrationNeeded) {
    return (
      <Card><CardContent className="p-6 text-sm text-amber-800">
        Falta ejecutar <b>migration-fundadores.sql</b> en Supabase (SQL Editor → Run).{' '}
        <a href="/migration-fundadores.sql" target="_blank" rel="noreferrer" className="font-semibold underline">Descargar SQL</a>
      </CardContent></Card>
    );
  }

  const p = data.program;
  const b = detail?.benefit;

  return (
    <div className="space-y-4" data-testid="founders-admin">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400"><Rocket className="h-4 w-4" /> Growth Engine · Usuarios Fundadores</div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Configuración del programa</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Fecha y hora oficial de lanzamiento (hora de Madrid)</Label>
              <Input type="datetime-local" value={form?.launchAt || ''} disabled={Boolean(p.frozen_at)} data-testid="founders-launch-input"
                onChange={(e) => setForm({ ...form, launchAt: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Estado del programa</Label>
              <Select value={form?.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger data-testid="founders-status-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="closed">Cerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Nuevas elegibilidades</Label>
                <p className="text-xs text-slate-500">Si se desactiva, no entran negocios nuevos</p>
              </div>
              <Switch checked={Boolean(form?.newEligibilityEnabled)} onCheckedChange={(v) => setForm({ ...form, newEligibilityEnabled: v })} data-testid="founders-new-elig-switch" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={save} disabled={saving} data-testid="founders-save">
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Guardar
            </Button>
            <span className="text-xs text-slate-500">
              {p.frozen_at
                ? <>Lanzamiento producido: elegibilidad congelada el {fdate(p.frozen_at)} (la fecha ya no se puede cambiar).</>
                : p.launch_at
                  ? <>Al llegar la fecha se congela la elegibilidad y se cierra solo el modo lanzamiento (Pro gratis): empiezan los planes de pago.</>
                  : <>Sin fecha: el modo lanzamiento sigue activo y la elegibilidad es provisional.</>}
              {' '}Cerrar el programa no modifica los descuentos ya activos.
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {[
          ['all', 'Registrados antes del lanzamiento'], ['eligible', 'Elegibles'], ['not_eligible', 'No elegibles'],
          ['pending', 'Pendientes'], ['active', 'Descuentos activos'], ['finished', 'Finalizados'],
        ].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} data-testid={`founders-stat-${k}`}
            className={`rounded-xl border bg-white p-3 text-left transition hover:border-indigo-300 ${filter === k ? 'border-indigo-500 ring-1 ring-indigo-500' : ''}`}>
            <div className="text-2xl font-bold">{counts[k]}</div>
            <div className="text-xs text-slate-500">{l}</div>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 pb-3 md:flex-row md:items-center md:justify-between">
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="eligible">Elegibles</TabsTrigger>
              <TabsTrigger value="not_eligible">No elegibles</TabsTrigger>
              <TabsTrigger value="pending">Pendientes</TabsTrigger>
              <TabsTrigger value="active">Activos</TabsTrigger>
              <TabsTrigger value="finished">Finalizados</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex w-full flex-wrap gap-2 md:w-auto">
            <div className="relative min-w-0 flex-1 md:flex-none">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input className="w-full pl-8 md:w-64" placeholder="Negocio, propietario o ID" value={q} onChange={(e) => setQ(e.target.value)} data-testid="founders-search" />
            </div>
            <Button variant="outline" onClick={() => setShowAudit(true)} data-testid="founders-audit-btn"><History className="mr-1 h-4 w-4" /> Auditoría</Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[860px] text-sm" data-testid="founders-table">
            <thead className="border-y bg-slate-50 text-left text-xs text-slate-500">
              <tr><th className="px-4 py-2">Negocio</th><th className="px-4 py-2">Propietario</th><th className="px-4 py-2">Plan</th><th className="px-4 py-2">Estado</th><th className="px-4 py-2">Ciclos</th><th className="px-4 py-2">Activación</th><th className="px-4 py-2" /></tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((r) => {
                const st = FOUNDER_STATUS[r.status] || FOUNDER_STATUS.pending;
                return (
                  <tr key={r.tenantId} className="hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <div className="font-medium">{r.name}</div>
                      <div className="font-mono text-[10px] text-slate-400">{r.tenantId}</div>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{r.owners[0]?.email || r.email || '—'}{r.owners.length > 1 && <span className="text-xs text-slate-400"> +{r.owners.length - 1}</span>}</td>
                    <td className="px-4 py-2">{PLAN[r.planId] || r.planId}{r.subscriptionStatus ? <span className="text-xs text-slate-400"> · {r.subscriptionStatus}</span> : ''}</td>
                    <td className="px-4 py-2"><Badge className={st.cls}>{st.label}</Badge>{r.override && <span className="ml-1 text-[10px] text-amber-600">manual</span>}</td>
                    <td className="px-4 py-2">{r.cyclesUsed} / {r.totalCycles}</td>
                    <td className="px-4 py-2 text-slate-600">{r.activatedAt ? fdate(r.activatedAt) : '—'}</td>
                    <td className="px-4 py-2 text-right"><Button size="sm" variant="outline" onClick={() => openDetail(r)}>Ver</Button></td>
                  </tr>
                );
              })}
              {visible.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Sin resultados</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Detalle del negocio */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="founders-detail">
          <DialogHeader>
            <DialogTitle>{detail?.row?.name}</DialogTitle>
            <DialogDescription className="font-mono text-xs">{detail?.row?.tenantId}</DialogDescription>
          </DialogHeader>
          {detail?.loading ? <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div> : (
            <div className="space-y-4 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border p-2"><span className="text-xs text-slate-500">Estado</span><div className="font-semibold">{(FOUNDER_STATUS[detail?.status] || {}).label}</div></div>
                <div className="rounded-lg border p-2"><span className="text-xs text-slate-500">Elegibilidad</span><div className="font-semibold">{b?.eligibility_status}{b?.frozen ? ' (congelada)' : ' (provisional)'}{b?.eligibility_override ? ' · manual' : ''}</div></div>
                <div className="rounded-lg border p-2"><span className="text-xs text-slate-500">Plan inicial / actual</span><div className="font-semibold">{PLAN[b?.initial_plan_id] || '—'} / {PLAN[b?.current_plan_id] || '—'} {b?.billing_interval ? `· ${b.billing_interval}` : ''}</div></div>
                <div className="rounded-lg border p-2"><span className="text-xs text-slate-500">Ciclos pagados</span><div className="font-semibold">{b?.cycles_used || 0} consumidos · {(b?.total_cycles || 3) - (b?.cycles_used || 0)} restantes</div></div>
                <div className="rounded-lg border p-2"><span className="text-xs text-slate-500">Activación / fin</span><div className="font-semibold">{fdate(b?.activated_at)} / {fdate(b?.ended_at)}{b?.end_reason ? ` (${b.end_reason})` : ''}</div></div>
                <div className="rounded-lg border p-2"><span className="text-xs text-slate-500">Suscripción Stripe</span><div className="truncate font-mono text-xs">{b?.stripe_subscription_id || '—'}</div></div>
              </div>

              <div>
                <div className="mb-1 font-semibold">Requisitos (datos reales)</div>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {Object.entries(REQ_LABELS).map(([k, l]) => (
                    <li key={k} className="flex items-center gap-1.5">
                      {b?.requirements?.[k] ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-slate-300" />} {l}
                    </li>
                  ))}
                </ul>
              </div>

              {detail?.cycles?.length > 0 && (
                <div>
                  <div className="mb-1 font-semibold">Ciclos pagados</div>
                  <ul className="divide-y rounded-lg border">
                    {detail.cycles.map((c) => (
                      <li key={c.id} className="flex justify-between px-3 py-1.5"><span>{fdate(c.created_at)} · {c.billing_reason} · {c.billing_interval}</span><span>{c.amount_paid} € · +{c.cycles_counted}</span></li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <div className="mb-1 font-semibold">Historial (plan, cancelaciones, recontrataciones y auditoría)</div>
                <ul className="max-h-56 divide-y overflow-y-auto rounded-lg border">
                  {(detail?.history || []).map((e) => (
                    <li key={e.id} className="px-3 py-1.5">
                      <div className="flex justify-between gap-2"><span className={e.action === 'founder.admin_blocked' ? 'font-semibold text-rose-600' : 'font-medium'}>{ACTION_LABELS[e.action] || e.action}</span><span className="shrink-0 text-xs text-slate-400">{fdate(e.created_at)}</span></div>
                      {metaText(e) && <div className="text-xs text-slate-500">{metaText(e)}</div>}
                    </li>
                  ))}
                  {!(detail?.history || []).length && <li className="px-3 py-2 text-slate-500">Sin movimientos</li>}
                </ul>
              </div>

              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center gap-1.5 font-semibold text-amber-900"><ShieldAlert className="h-4 w-4" /> Corrección administrativa</div>
                <p className="text-xs text-amber-800">Queda registrada en auditoría. Nunca se puede conceder un segundo beneficio a un negocio que ya lo usó.</p>
                <Textarea placeholder="Motivo (obligatorio)" value={reason} onChange={(e) => setReason(e.target.value)} data-testid="founders-reason" />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={acting || !reason.trim()} onClick={() => act('set_eligible')} data-testid="founders-set-eligible">Marcar elegible</Button>
                  <Button size="sm" variant="outline" disabled={acting || !reason.trim()} onClick={() => act('set_not_eligible')} data-testid="founders-set-not-eligible">Marcar no elegible</Button>
                  <Button size="sm" variant="destructive" disabled={acting || !reason.trim() || !['active', 'reserved'].includes(b?.benefit_status)} onClick={() => act('revoke')} data-testid="founders-revoke">Revocar descuento</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Auditoría global */}
      <Dialog open={showAudit} onOpenChange={setShowAudit}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Historial de auditoría</DialogTitle><DialogDescription>Últimos movimientos del programa y de las suscripciones</DialogDescription></DialogHeader>
          <ul className="divide-y rounded-lg border text-sm">
            {(data.audit || []).map((e) => (
              <li key={e.id} className="px-3 py-1.5">
                <div className="flex justify-between gap-2">
                  <span className={e.action === 'founder.admin_blocked' ? 'font-semibold text-rose-600' : 'font-medium'}>{ACTION_LABELS[e.action] || e.action}</span>
                  <span className="shrink-0 text-xs text-slate-400">{fdate(e.created_at)}</span>
                </div>
                <div className="text-xs text-slate-500">{rows.find((r) => r.tenantId === e.tenant_id)?.name || (e.tenant_id ? e.tenant_id : 'Plataforma')}{metaText(e) ? ` · ${metaText(e)}` : ''}</div>
              </li>
            ))}
            {!(data.audit || []).length && <li className="px-3 py-2 text-slate-500">Sin movimientos todavía</li>}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
