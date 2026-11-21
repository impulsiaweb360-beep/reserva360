'use client';

// Dashboard comercial con cifras reales (CRM + negocios reales de la app)
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, UserPlus, PhoneCall, Sparkles, CalendarCheck, Presentation, Building2, Trophy, XCircle, BellOff, Target, AlertTriangle, Link2, ListTodo } from 'lucide-react';
import { CRM_STAGES, sourceLabel } from '@/lib/crm/constants';
import { crm, Stat, fmtDateTime, PriorityBadge, leadName } from './shared';

export default function CrmDashboard({ rev, onOpenLead, onError, onGo }) {
  const [s, setS] = useState(null);
  useEffect(() => { crm('stats').then(setS).catch(onError); }, [rev, onError]);
  if (!s) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  const L = s.leads;
  const maxStage = Math.max(1, ...Object.values(L.byStage));
  return (
    <div className="space-y-5 pt-2" data-testid="crm-dashboard">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Stat label="Total de leads" value={L.total} icon={Users} testid="crm-stat-total" />
        <Stat label="Leads nuevos" value={L.newStage} hint={`en etapa «Nuevo» · ${L.newThisWeek} altas esta semana`} icon={UserPlus} testid="crm-stat-new" />
        <Stat label="Pendientes de contactar" value={L.toContact} icon={PhoneCall} testid="crm-stat-tocontact" />
        <Stat label="Interesados" value={L.interested} icon={Sparkles} />
        <Stat label="Demos solicitadas" value={L.demoRequested} icon={CalendarCheck} />
        <Stat label="Demos realizadas" value={L.demoDone} icon={Presentation} />
        <Stat label="Negocios en FREE (reales)" value={s.app.free} hint={`de ${s.app.tenants} registrados`} icon={Building2} testid="crm-stat-free" />
        <Stat label="Clientes PRO (reales)" value={s.app.paidPro} hint="suscripción de pago activa" icon={Trophy} tone="text-emerald-700" testid="crm-stat-pro" />
        <Stat label="Clientes Business (reales)" value={s.app.paidBusiness} hint="suscripción de pago activa" icon={Trophy} tone="text-green-800" testid="crm-stat-business" />
        <Stat label="Leads perdidos" value={L.lost} icon={XCircle} tone="text-rose-700" />
        <Stat label="No desean comunicaciones" value={L.optedOut} icon={BellOff} />
        <Stat label="Oportunidades abiertas" value={L.open} icon={Target} tone="text-indigo-700" testid="crm-stat-open" />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          ['Lead → negocio registrado', s.conversion.leadToSignup, 'leads captados (sin contar altas directas en la app) que ya tienen cuenta'],
          ['FREE → PRO', s.conversion.freeToPro, 'negocios registrados que pagan PRO'],
          ['FREE → Business', s.conversion.freeToBusiness, 'negocios registrados que pagan Business'],
        ].map(([label, c, hint]) => (
          <div key={label} className="rounded-xl border bg-card p-4" data-testid={`crm-conv-${label.replace(/\W+/g, '-').toLowerCase()}`}>
            <p className="text-xs font-medium text-muted-foreground">Conversión {label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{c.value}%</p>
            <p className="text-xs text-muted-foreground">{c.num} de {c.den} · {hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><ListTodo className="h-4 w-4" />Tareas ({s.tasks.pending} pendientes)</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => onGo('tasks')}>Ver todas</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {s.tasks.overdue.length > 0 && (
              <div className="space-y-2" data-testid="crm-dash-overdue">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-700"><AlertTriangle className="h-3.5 w-3.5" />Vencidas ({s.tasks.overdue.length})</p>
                {s.tasks.overdue.slice(0, 6).map((t) => <TaskLine key={t.id} t={t} onOpenLead={onOpenLead} overdue />)}
              </div>
            )}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Próximas</p>
              {s.tasks.upcoming.length === 0 ? <p className="text-sm text-muted-foreground">No hay tareas próximas.</p> : s.tasks.upcoming.map((t) => <TaskLine key={t.id} t={t} onOpenLead={onOpenLead} />)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Leads por etapa</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {CRM_STAGES.map((st) => (
              <div key={st.id} className="flex items-center gap-2 text-sm">
                <span className="w-40 shrink-0 truncate text-xs text-muted-foreground">{st.label}</span>
                <div className="h-2 flex-1 rounded-full bg-muted"><div className={`h-2 rounded-full ${st.dot}`} style={{ width: `${(L.byStage[st.id] / maxStage) * 100}%` }} /></div>
                <span className="w-8 text-right text-xs tabular-nums">{L.byStage[st.id]}</span>
              </div>
            ))}
            <div className="flex flex-wrap gap-1.5 pt-3">
              {Object.entries(L.bySource).map(([k, v]) => <Badge key={k} variant="secondary" className="font-normal">{sourceLabel(k)}: {v}</Badge>)}
            </div>
          </CardContent>
        </Card>
      </div>

      {s.review.length > 0 && (
        <Card data-testid="crm-review-queue">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4 w-4" />Coincidencias por revisar ({s.review.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">Leads sin vincular cuyo email o teléfono coincide con una cuenta real. Nada se vincula solo: ábrelos y confirma.</p>
            {s.review.slice(0, 10).map((r) => (
              <button key={r.lead.id} onClick={() => onOpenLead(r.lead.id)} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-left hover:bg-muted/40">
                <span className="text-sm font-medium">{r.lead.name}</span>
                <span className="text-xs text-muted-foreground">{r.ambiguous ? `${r.candidates.length} posibles negocios · revisión manual` : `posible: ${r.candidates[0].name}`}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TaskLine({ t, onOpenLead, overdue }) {
  return (
    <button onClick={() => t.lead_id && onOpenLead(t.lead_id)} className={`flex w-full items-center justify-between gap-2 rounded-lg border p-2.5 text-left hover:bg-muted/40 ${overdue ? 'border-rose-200 bg-rose-50/50' : ''}`}>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{t.title}</span>
        <span className={`block text-xs ${overdue ? 'text-rose-700' : 'text-muted-foreground'}`}>{t.crm_leads ? leadName(t.crm_leads) : 'Sin lead'} · {t.due_at ? fmtDateTime(t.due_at) : 'sin fecha'}</span>
      </span>
      <PriorityBadge priority={t.priority} />
    </button>
  );
}
