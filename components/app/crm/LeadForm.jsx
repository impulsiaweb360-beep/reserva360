'use client';

// Formulario de alta / edición de lead, con datos legales (RGPD / LSSI)
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { CRM_SECTORS, CRM_SOURCES, LEGAL_BASES, INTEREST_LEVELS, SUGGESTED_PLANS, CRM_STAGES, CLIENT_STAGES } from '@/lib/crm/constants';
import { crm, leadName, toLocalInput, fromLocalInput } from './shared';

const EMPTY = {
  first_name: '', last_name: '', business_name: '', email: '', phone: '', website: '', sector: '', address: '', city: '', province: '',
  source: 'manual', source_detail: '', needs: '', employees_estimate: '', interest_level: '', suggested_plan: '', notes: '',
  legal_basis: 'legitimate_interest', data_origin: '', consent_at: '', consent_source: '',
  comm_email: false, comm_phone: false, comm_whatsapp: false, opted_out: false, stage: 'new',
};
const FIELDS = Object.keys(EMPTY).filter((k) => k !== 'stage');
const NONE = '__none__';

function Field({ label, children, className = '' }) {
  return <div className={`space-y-1.5 ${className}`}><Label className="text-xs">{label}</Label>{children}</div>;
}

export default function LeadForm({ open, onOpenChange, lead, onSaved }) {
  const editing = Boolean(lead?.id);
  const [f, setF] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [dups, setDups] = useState(null);

  useEffect(() => {
    if (!open) return;
    setDups(null);
    if (lead) {
      const next = { ...EMPTY };
      for (const k of FIELDS) next[k] = lead[k] ?? EMPTY[k];
      next.consent_at = toLocalInput(lead.consent_at);
      next.employees_estimate = lead.employees_estimate ?? '';
      setF(next);
    } else setF(EMPTY);
  }, [open, lead]);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e?.target ? e.target.value : e }));
  const sel = (k) => (v) => setF((p) => ({ ...p, [k]: v === NONE ? '' : v }));
  const allowsComm = ['consent', 'contract'].includes(f.legal_basis);

  async function save(confirmDuplicates = false) {
    setSaving(true);
    try {
      const payload = {};
      for (const k of FIELDS) payload[k] = f[k];
      payload.consent_at = fromLocalInput(f.consent_at);
      payload.employees_estimate = f.employees_estimate === '' ? null : Number(f.employees_estimate);
      if (!allowsComm) { payload.comm_email = false; payload.comm_whatsapp = false; }
      let saved;
      if (editing) {
        saved = await crm(`leads/${lead.id}`, { method: 'PATCH', body: payload });
        toast.success('Lead actualizado');
        onSaved?.(saved.lead);
      } else {
        saved = await crm('leads', { method: 'POST', body: { ...payload, stage: f.stage, confirmDuplicates } });
        toast.success('Lead creado');
        onSaved?.(saved.lead);
      }
      onOpenChange(false);
    } catch (e) {
      if (e.data?.duplicates) setDups({ list: e.data.duplicates, canForce: e.data.code === 'possible_duplicate' });
      toast.error(e.message);
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto" data-testid="crm-lead-form">
        <DialogHeader>
          <DialogTitle>{editing ? `Editar · ${leadName(lead)}` : 'Nuevo lead'}</DialogTitle>
          <DialogDescription>Solo datos profesionales necesarios. Indica siempre de dónde proceden.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section>
            <h4 className="mb-3 text-sm font-semibold">Datos de contacto</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre del negocio"><Input value={f.business_name} onChange={set('business_name')} data-testid="lead-business-name" /></Field>
              <Field label="Sector">
                <Select value={f.sector || NONE} onValueChange={sel('sector')}>
                  <SelectTrigger data-testid="lead-sector"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value={NONE}>Sin indicar</SelectItem>{CRM_SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Nombre"><Input value={f.first_name} onChange={set('first_name')} data-testid="lead-first-name" /></Field>
              <Field label="Apellidos"><Input value={f.last_name} onChange={set('last_name')} data-testid="lead-last-name" /></Field>
              <Field label="Email"><Input type="email" value={f.email} onChange={set('email')} data-testid="lead-email" /></Field>
              <Field label="Teléfono"><Input value={f.phone} onChange={set('phone')} data-testid="lead-phone" /></Field>
              <Field label="Web"><Input value={f.website} onChange={set('website')} placeholder="https://…" /></Field>
              <Field label="Dirección o ubicación"><Input value={f.address} onChange={set('address')} /></Field>
              <Field label="Ciudad"><Input value={f.city} onChange={set('city')} data-testid="lead-city" /></Field>
              <Field label="Provincia"><Input value={f.province} onChange={set('province')} data-testid="lead-province" /></Field>
            </div>
          </section>

          <section>
            <h4 className="mb-3 text-sm font-semibold">Información comercial</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Fuente de captación">
                <Select value={f.source} onValueChange={sel('source')}>
                  <SelectTrigger data-testid="lead-source"><SelectValue /></SelectTrigger>
                  <SelectContent>{CRM_SOURCES.filter((s) => s.id !== 'app_signup' || f.source === 'app_signup').map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Detalle de la fuente"><Input value={f.source_detail} onChange={set('source_detail')} placeholder="Campaña, quién lo refirió…" /></Field>
              {!editing && (
                <Field label="Etapa inicial">
                  <Select value={f.stage} onValueChange={sel('stage')}>
                    <SelectTrigger data-testid="lead-stage"><SelectValue /></SelectTrigger>
                    <SelectContent>{CRM_STAGES.filter((s) => !CLIENT_STAGES.includes(s.id)).map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              )}
              <Field label="Nº aproximado de empleados"><Input type="number" min="0" value={f.employees_estimate} onChange={set('employees_estimate')} /></Field>
              <Field label="Interés en Reserva360">
                <Select value={f.interest_level || NONE} onValueChange={sel('interest_level')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value={NONE}>Sin valorar</SelectItem>{INTEREST_LEVELS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Plan que podría necesitar">
                <Select value={f.suggested_plan || NONE} onValueChange={sel('suggested_plan')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value={NONE}>Sin decidir</SelectItem>{SUGGESTED_PLANS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Necesidades del negocio" className="sm:col-span-2"><Textarea rows={2} value={f.needs} onChange={set('needs')} /></Field>
              <Field label="Observaciones internas" className="sm:col-span-2"><Textarea rows={2} value={f.notes} onChange={set('notes')} data-testid="lead-notes" /></Field>
            </div>
          </section>

          <section className="rounded-xl border bg-muted/30 p-4">
            <h4 className="mb-1 flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Privacidad y origen de los datos</h4>
            <p className="mb-3 text-xs text-muted-foreground">Que un teléfono o email sea público no autoriza a enviar publicidad. En esta fase el CRM no envía nada.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Base jurídica">
                <Select value={f.legal_basis} onValueChange={sel('legal_basis')}>
                  <SelectTrigger data-testid="lead-legal-basis"><SelectValue /></SelectTrigger>
                  <SelectContent>{LEGAL_BASES.filter((l) => l.id !== 'contract' || f.legal_basis === 'contract').map((l) => <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">{LEGAL_BASES.find((l) => l.id === f.legal_basis)?.hint}</p>
              </Field>
              <Field label="Origen documentado de los datos"><Input value={f.data_origin} onChange={set('data_origin')} placeholder="Ej.: tarjeta en feria X, web pública del negocio…" data-testid="lead-data-origin" /></Field>
              {f.legal_basis === 'consent' && (
                <>
                  <Field label="Fecha del consentimiento"><Input type="datetime-local" value={f.consent_at} onChange={set('consent_at')} data-testid="lead-consent-at" /></Field>
                  <Field label="Origen del consentimiento"><Input value={f.consent_source} onChange={set('consent_source')} placeholder="Formulario, email del contacto…" data-testid="lead-consent-source" /></Field>
                </>
              )}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ['comm_email', 'Acepta comunicaciones por email', !allowsComm],
                ['comm_whatsapp', 'Acepta comunicaciones por WhatsApp', !allowsComm],
                ['comm_phone', 'Acepta llamadas comerciales', false],
                ['opted_out', 'Se opone a comunicaciones comerciales', false],
              ].map(([k, label, disabled]) => (
                <label key={k} className={`flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-sm ${disabled ? 'opacity-60' : ''}`}>
                  <span>{label}</span>
                  <Switch checked={Boolean(f[k]) && !(disabled && k !== 'opted_out')} disabled={disabled || (f.opted_out && k !== 'opted_out')} onCheckedChange={(v) => setF((p) => ({ ...p, [k]: v }))} data-testid={`lead-${k}`} />
                </label>
              ))}
            </div>
            {!allowsComm && <p className="mt-2 text-[11px] text-muted-foreground">Email y WhatsApp comerciales solo con consentimiento (LSSI).</p>}
          </section>

          {dups && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm" data-testid="lead-duplicates">
              <p className="flex items-center gap-2 font-medium text-amber-900"><AlertTriangle className="h-4 w-4" /> Posibles duplicados</p>
              <ul className="mt-1 list-disc pl-5 text-amber-900">
                {dups.list.map((d) => <li key={d.id}>{leadName(d)} · {d.reason === 'email' ? 'mismo email' : 'mismo teléfono'}</li>)}
              </ul>
              {dups.canForce && <Button size="sm" variant="outline" className="mt-2" onClick={() => save(true)} disabled={saving} data-testid="lead-force-create">Es otro contacto: crear igualmente</Button>}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save(false)} disabled={saving} data-testid="lead-save">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing ? 'Guardar cambios' : 'Crear lead'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
