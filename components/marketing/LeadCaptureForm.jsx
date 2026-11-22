'use client';

// Formulario público de captación de Reserva360 → CRM Comercial (validación final siempre en servidor)
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, Loader2, ShieldCheck, ArrowRight } from 'lucide-react';
import { CRM_SECTORS } from '@/lib/crm/constants';
import { REQUEST_TYPES, EMPLOYEE_RANGES, CURRENT_SYSTEMS, CONSENT_TEXTS } from '@/lib/crm/consent';

const SELECT = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const uuid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`);
const EMPTY = { first_name: '', last_name: '', business_name: '', email: '', phone: '', city: '', province: '', sector: '', employees_range: '', current_system: '', problem: '', interest: '' };

function Field({ id, label, required, error, children, className = '' }) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="text-sm font-medium text-slate-800">{label}{required && <span className="text-rose-600"> *</span>}</Label>
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1 text-xs text-rose-600" role="alert">{error}</p>}
    </div>
  );
}

export default function LeadCaptureForm({ defaultRequest = 'info', page = '/contacto', compact = false, idPrefix = 'lead' }) {
  const [v, setV] = useState(EMPTY);
  const [request, setRequest] = useState(defaultRequest);
  const [consents, setConsents] = useState({ privacy: false, email: false, whatsapp: false });
  const [website, setWebsite] = useState(''); // trampa para bots (oculto)
  const [cfg, setCfg] = useState({ enabled: true, turnstileSiteKey: null, loaded: false });
  const [state, setState] = useState({ sending: false, error: null, field: null, done: null });
  const submissionId = useRef(uuid());
  const startedAt = useRef(Date.now());
  const tsRef = useRef(null);
  const tsWidget = useRef(null);
  const tsToken = useRef('');

  useEffect(() => {
    fetch('/api/capture/config').then((r) => r.json()).then((c) => setCfg({ ...c, loaded: true })).catch(() => setCfg((x) => ({ ...x, loaded: true })));
  }, []);

  // Cloudflare Turnstile (solo si está configurado): se carga el script únicamente en las páginas con formulario
  useEffect(() => {
    if (!cfg.turnstileSiteKey) return undefined;
    const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    if (!document.querySelector(`script[src="${SRC}"]`)) {
      const s = document.createElement('script'); s.src = SRC; s.async = true; s.defer = true; document.head.appendChild(s);
    }
    let cancelled = false;
    const mount = () => {
      if (cancelled || !tsRef.current || !window.turnstile || tsWidget.current) return;
      tsWidget.current = window.turnstile.render(tsRef.current, {
        sitekey: cfg.turnstileSiteKey, action: 'lead_form', language: 'es',
        callback: (t) => { tsToken.current = t; },
        'expired-callback': () => { tsToken.current = ''; },
        'error-callback': () => { tsToken.current = ''; },
      });
    };
    const timer = setInterval(mount, 150);
    mount();
    return () => { cancelled = true; clearInterval(timer); };
  }, [cfg.turnstileSiteKey]);

  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const err = (f) => (state.field === f ? state.error : null);

  async function submit(e) {
    e.preventDefault();
    if (state.sending) return;
    if (!consents.privacy) { setState({ sending: false, error: 'Necesitamos tu aceptación para gestionar la solicitud', field: 'consent_privacy', done: null }); return; }
    if (cfg.turnstileSiteKey && !tsToken.current) { setState({ sending: false, error: 'Completa la verificación «No soy un robot».', field: 'turnstile', done: null }); return; }
    setState({ sending: true, error: null, field: null, done: null });
    const payload = {
      ...Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.trim() ? x.trim() : null])),
      request_type: request,
      consent_privacy: true, consent_email: consents.email, consent_whatsapp: consents.whatsapp,
      submission_id: submissionId.current, page, started_at: startedAt.current, website: website || null,
      turnstile_token: tsToken.current || null,
    };
    try {
      const r = await fetch('/api/capture/submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setState({ sending: false, error: j.error || 'No hemos podido enviar tu solicitud.', field: j.field || null, done: null });
        if (tsWidget.current && window.turnstile) { window.turnstile.reset(tsWidget.current); tsToken.current = ''; }
        return;
      }
      try { window.dataLayer?.push({ event: 'generate_lead', lead_request: request, form_page: page }); } catch { /* sin analítica */ }
      setState({ sending: false, error: null, field: null, done: { signupUrl: j.signupUrl || null } });
    } catch {
      setState({ sending: false, error: 'Error de conexión. Inténtalo de nuevo.', field: null, done: null });
    }
  }

  if (state.done) {
    return (
      <div data-testid="lead-form-success" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden="true" />
        <h3 className="mt-4 text-xl font-bold text-slate-900">¡Solicitud recibida!</h3>
        <p className="mt-2 text-slate-700">
          {request === 'demo' ? 'Te escribiremos para acordar el día y la hora de tu demostración.' : 'Te responderemos lo antes posible con la información que nos pides.'}
        </p>
        {state.done.signupUrl && (
          <Button asChild className="mt-6" data-testid="lead-form-signup">
            <a href={state.done.signupUrl}>Crear mi cuenta gratis <ArrowRight className="ml-1 h-4 w-4" /></a>
          </Button>
        )}
      </div>
    );
  }

  if (cfg.loaded && !cfg.enabled) {
    return (
      <div data-testid="lead-form-disabled" className="rounded-2xl border bg-slate-50 p-6 text-center text-slate-700">
        El formulario no está disponible en este momento. Escríbenos a <a className="font-medium text-indigo-600" href="mailto:reserva360.app@gmail.com">reserva360.app@gmail.com</a>.
      </div>
    );
  }

  const id = (k) => `${idPrefix}-${k}`;
  return (
    <form onSubmit={submit} noValidate data-testid="lead-form" className="space-y-6">
      {/* Tipo de solicitud */}
      <fieldset>
        <legend className="text-sm font-semibold text-slate-900">¿Qué necesitas?<span className="text-rose-600"> *</span></legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {REQUEST_TYPES.map((r) => (
            <label key={r.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition ${request === r.id ? 'border-indigo-500 bg-indigo-50 font-medium text-indigo-900' : 'border-slate-200 hover:border-slate-300'}`}>
              <input type="radio" name={id('request')} value={r.id} checked={request === r.id} onChange={() => setRequest(r.id)} className="accent-indigo-600" data-testid={`lead-request-${r.id}`} />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Datos de contacto */}
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-semibold text-slate-900 sm:col-span-2">Datos de contacto</legend>
        <Field id={id('first_name')} label="Nombre" required error={err('first_name')}><Input id={id('first_name')} autoComplete="given-name" maxLength={80} value={v.first_name} onChange={set('first_name')} data-testid="lead-first-name" /></Field>
        <Field id={id('last_name')} label="Apellidos" error={err('last_name')}><Input id={id('last_name')} autoComplete="family-name" maxLength={120} value={v.last_name} onChange={set('last_name')} data-testid="lead-last-name" /></Field>
        <Field id={id('business_name')} label="Nombre del negocio" required error={err('business_name')} className="sm:col-span-2"><Input id={id('business_name')} autoComplete="organization" maxLength={160} value={v.business_name} onChange={set('business_name')} data-testid="lead-business" /></Field>
        <Field id={id('email')} label="Email" required error={err('email')}><Input id={id('email')} type="email" autoComplete="email" maxLength={200} value={v.email} onChange={set('email')} data-testid="lead-email" /></Field>
        <Field id={id('phone')} label="Teléfono" error={err('phone')}><Input id={id('phone')} type="tel" autoComplete="tel" maxLength={20} placeholder="+34 600 000 000" value={v.phone} onChange={set('phone')} data-testid="lead-phone" /></Field>
        <Field id={id('city')} label="Ciudad" error={err('city')}><Input id={id('city')} autoComplete="address-level2" maxLength={80} value={v.city} onChange={set('city')} data-testid="lead-city" /></Field>
        <Field id={id('province')} label="Provincia" error={err('province')}><Input id={id('province')} autoComplete="address-level1" maxLength={80} value={v.province} onChange={set('province')} data-testid="lead-province" /></Field>
      </fieldset>

      {/* Información del negocio */}
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-semibold text-slate-900 sm:col-span-2">Tu negocio</legend>
        <Field id={id('sector')} label="Tipo de negocio" required error={err('sector')}>
          <select id={id('sector')} className={SELECT} value={v.sector} onChange={set('sector')} data-testid="lead-sector">
            <option value="">Elige una opción</option>
            {CRM_SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field id={id('employees_range')} label="Nº aproximado de empleados" error={err('employees_range')}>
          <select id={id('employees_range')} className={SELECT} value={v.employees_range} onChange={set('employees_range')} data-testid="lead-employees">
            <option value="">Elige una opción</option>
            {EMPLOYEE_RANGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field id={id('current_system')} label="¿Cómo gestionas hoy las reservas?" error={err('current_system')} className="sm:col-span-2">
          <select id={id('current_system')} className={SELECT} value={v.current_system} onChange={set('current_system')} data-testid="lead-system">
            <option value="">Elige una opción</option>
            {CURRENT_SYSTEMS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        {!compact && (
          <>
            <Field id={id('problem')} label="Principal problema que quieres solucionar" error={err('problem')} className="sm:col-span-2"><Textarea id={id('problem')} rows={2} maxLength={1000} placeholder="Ej.: clientes que no se presentan, muchas llamadas para reservar…" value={v.problem} onChange={set('problem')} data-testid="lead-problem" /></Field>
            <Field id={id('interest')} label="¿Qué te interesa de Reserva360?" error={err('interest')} className="sm:col-span-2"><Textarea id={id('interest')} rows={2} maxLength={1000} placeholder="Ej.: reservas online, recordatorios por WhatsApp, varios profesionales…" value={v.interest} onChange={set('interest')} data-testid="lead-interest" /></Field>
          </>
        )}
      </fieldset>

      {/* Campo trampa: invisible para personas */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={id('website')}>No rellenes este campo</label>
        <input id={id('website')} name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      {/* Privacidad y comunicaciones: casillas independientes, ninguna premarcada */}
      <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-900">Privacidad y comunicaciones</legend>
        <p className="text-xs leading-relaxed text-slate-600" data-testid="lead-privacy-info">{CONSENT_TEXTS.info} Más información en la <Link href="/privacidad" className="font-medium text-indigo-600 underline">política de privacidad</Link>.</p>
        <label className="flex items-start gap-2.5 text-sm text-slate-800">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-indigo-600" checked={consents.privacy} onChange={(e) => setConsents((c) => ({ ...c, privacy: e.target.checked }))} data-testid="lead-consent-privacy" />
          <span>{CONSENT_TEXTS.privacy} <span className="text-rose-600">*</span></span>
        </label>
        {err('consent_privacy') && <p className="text-xs text-rose-600" role="alert">{err('consent_privacy')}</p>}
        <label className="flex items-start gap-2.5 text-sm text-slate-800">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-indigo-600" checked={consents.email} onChange={(e) => setConsents((c) => ({ ...c, email: e.target.checked }))} data-testid="lead-consent-email" />
          <span>{CONSENT_TEXTS.email}</span>
        </label>
        <label className="flex items-start gap-2.5 text-sm text-slate-800">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-indigo-600" checked={consents.whatsapp} onChange={(e) => setConsents((c) => ({ ...c, whatsapp: e.target.checked }))} data-testid="lead-consent-whatsapp" />
          <span>{CONSENT_TEXTS.whatsapp}</span>
        </label>
        <p className="text-xs text-slate-500">Las casillas de publicidad son opcionales: puedes pedir información o una demo sin marcarlas.</p>
      </fieldset>

      {cfg.turnstileSiteKey && (
        <div>
          <div ref={tsRef} aria-label="Verificación antispam" data-testid="lead-turnstile" />
          {err('turnstile') && <p className="mt-1 text-xs text-rose-600" role="alert">{err('turnstile')}</p>}
        </div>
      )}

      {state.error && !['first_name', 'last_name', 'business_name', 'email', 'phone', 'city', 'province', 'sector', 'consent_privacy', 'turnstile', 'employees_range', 'current_system', 'problem', 'interest'].includes(state.field) && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert" data-testid="lead-form-error">{state.error}</p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-1.5 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" /> No compartimos tus datos. Sin compromiso.</p>
        <Button type="submit" size="lg" disabled={state.sending} data-testid="lead-submit">
          {state.sending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…</> : request === 'demo' ? 'Solicitar demostración' : 'Enviar solicitud'}
        </Button>
      </div>
    </form>
  );
}
