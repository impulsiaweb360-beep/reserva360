'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
dayjs.locale('es');
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { getWorkingWindows } from '@/lib/booking';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, Clock, Euro, Calendar as CalIcon, User, ChevronRight, ArrowLeft, MapPin, Phone, Mail, Sparkles } from 'lucide-react';
import { useInitialTenant } from './initial-tenant';

// Normaliza tenant desde DB (snake_case) a estructura de UI (camelCase) que usan getAvailableSlots y getWorkingWindows
function normalizeTenant(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    industry: raw.industry,
    logo: raw.logo,
    color: raw.color,
    email: raw.email,
    phone: raw.phone,
    address: raw.address,
    status: raw.status,
    businessHours: raw.business_hours,
    vacations: raw.vacations,
    services: (raw.services || []).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      duration: s.duration_minutes,
      price: Number(s.price),
      color: s.color,
      active: s.active,
    })),
    employees: (raw.employees || []).map((e) => ({
      id: e.id,
      firstName: e.first_name,
      lastName: e.last_name,
      specialty: e.specialty,
      color: e.color,
      schedule: (e.schedule && Object.keys(e.schedule).length > 0) ? e.schedule : null,
      active: e.active,
    })),
  };
}

export default function BookPage() {
  const params = useParams();
  const slug = params?.slug;
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  // Datos del negocio ya cargados en el servidor (SEO): la página se pinta completa desde el primer HTML
  const initialData = useInitialTenant();

  const [loading, setLoading] = useState(!initialData);
  const [tenant, setTenant] = useState(() => (initialData ? normalizeTenant(initialData) : null));
  const [notFound, setNotFound] = useState(false);

  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState(null);
  const [employeeId, setEmployeeId] = useState('any');
  const [date, setDate] = useState(dayjs().add(1, 'day').startOf('day'));
  const [slot, setSlot] = useState(null);
  const [client, setClient] = useState({ firstName: '', lastName: '', email: '', phone: '', notes: '' });
  const [paymentMethod, setPaymentMethod] = useState('onsite');
  const [payCfg, setPayCfg] = useState(null);
  useEffect(() => {
    if (!slug) return;
    fetch(`/api/public/${slug}/payments`).then((r) => (r.ok ? r.json() : null)).then(setPayCfg).catch(() => {});
  }, [slug]);
  const [confirmedAppt, setConfirmedAppt] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Load tenant + services + employees via RPC
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc('get_public_tenant', { p_slug: slug });
      if (error) {
        console.error(error);
        if (!initialData) setNotFound(true);
      } else if (!data) {
        if (!initialData) setNotFound(true);
      } else {
        setTenant(normalizeTenant(data));
      }
      setLoading(false);
    })();
  }, [slug, supabase]);

  const services = tenant?.services || [];
  const employees = tenant?.employees || [];
  const service = services.find((s) => s.id === serviceId);
  const svcPay = payCfg?.enabled && service ? payCfg.services?.[service.id] : null;

  // Huecos libres calculados en SERVIDOR (zona horaria del negocio, horario, descansos, vacaciones y citas)
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  useEffect(() => {
    if (!tenant || step < 4 || !serviceId) return;
    let cancelled = false;
    (async () => {
      setSlotsLoading(true);
      try {
        const params = new URLSearchParams({
          date: date.format('YYYY-MM-DD'),
          service_id: serviceId,
          employee_id: employeeId || 'any',
        });
        const r = await fetch(`/api/public/${slug}/slots?${params.toString()}`);
        const j = await r.json();
        if (!cancelled) setAvailableSlots(r.ok ? j.slots || [] : []);
      } catch {
        if (!cancelled) setAvailableSlots([]);
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenant, step, date, employeeId, serviceId, slug]);

  const dayOptions = useMemo(() => Array.from({ length: 14 }, (_, i) => dayjs().startOf('day').add(i, 'day')), []);
  const hasSlotsOnDay = (d) => {
    if (!tenant) return false;
    const empList = employeeId === 'any' ? employees : employees.filter((e) => e.id === employeeId);
    return empList.some((emp) => getWorkingWindows(d, tenant, emp).length > 0);
  };

  const submit = async () => {
    if (!client.firstName || !client.phone) {
      setSubmitError('Nombre y teléfono son obligatorios');
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const r = await fetch('/api/public/book', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug,
          service_id: service.id,
          employee_id: slot.employeeId,
          start_at: slot.start,
          client: {
            firstName: client.firstName,
            lastName: client.lastName,
            email: client.email,
            phone: client.phone,
            notes: client.notes,
          },
          pay_online: paymentMethod === 'stripe',
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setSubmitError(j.error || 'No se pudo crear la reserva');
        setSubmitting(false);
        return;
      }
      if (j.checkout_url) {
        // Pago online: Stripe confirma la cita y envía los avisos al volver
        window.location.href = j.checkout_url;
        return;
      }
      const newId = j.id;
      setConfirmedAppt({
        id: newId,
        employeeId: slot.employeeId,
        start: slot.start,
      });
      setStep(6);

      // Enviar email de confirmación con link manage/
      try {
        await fetch('/api/public/send-confirmation', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ appointment_id: newId }),
        });
      } catch (e) { console.error('email confirmation failed', e); }
    } catch (e) {
      setSubmitError(String(e?.message || e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-slate-50"><div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" /></div>;
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="max-w-md"><CardContent className="p-8 text-center">
          <div className="mb-3 text-5xl">🔍</div>
          <h1 className="text-xl font-bold">Negocio no encontrado</h1>
          <p className="mt-2 text-sm text-slate-500">La URL <code>/{slug}</code> no corresponde a ningún negocio activo.</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="container mx-auto flex flex-col items-start gap-3 px-6 py-6 md:flex-row md:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-3xl shadow overflow-hidden" style={{ background: `${tenant.color}15`, border: `2px solid ${tenant.color}30` }}>
            {tenant.logo && /^https?:\/\//.test(tenant.logo) ? (
              <img src={tenant.logo} alt={tenant.name} className="h-full w-full object-contain p-1" />
            ) : (
              <span>{tenant.logo || '✨'}</span>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900" translate="no">{tenant.name}</h1>
            <p className="text-sm text-slate-500">{tenant.industry}</p>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
              {tenant.address && <span className="flex items-center gap-1" translate="no"><MapPin className="h-3 w-3" />{tenant.address}</span>}
              {tenant.phone && <span className="flex items-center gap-1" translate="no"><Phone className="h-3 w-3" />{tenant.phone}</span>}
              {tenant.email && <span className="flex items-center gap-1" translate="no"><Mail className="h-3 w-3" />{tenant.email}</span>}
            </div>
          </div>
          <Badge style={{ background: `${tenant.color}20`, color: tenant.color }} className="border-0">
            <Sparkles className="mr-1 h-3 w-3" /> Reserva online
          </Badge>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {step < 6 && (
          <div className="mx-auto mb-6 flex max-w-2xl items-center justify-between text-xs">
            {['Servicio', 'Profesional', 'Fecha', 'Hora', 'Confirmar'].map((label, i) => {
              const n = i + 1;
              const active = step === n;
              const done = step > n;
              return (
                <div key={label} className="flex flex-1 items-center">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${active ? 'bg-indigo-600 text-white shadow' : done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {done ? <CheckCircle2 className="h-4 w-4" /> : n}
                  </div>
                  <span className={`ml-2 hidden font-medium md:inline ${active ? 'text-slate-900' : 'text-slate-500'}`}>{label}</span>
                  {i < 4 && <div className={`mx-2 h-0.5 flex-1 ${done ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
                </div>
              );
            })}
          </div>
        )}

        <div className="mx-auto max-w-2xl">
          {step === 1 && (
            <Card><CardContent className="p-6">
              <h2 className="mb-4 text-lg font-semibold">Elige un servicio</h2>
              {services.length === 0 ? (
                <p className="text-sm text-slate-500">Este negocio aún no tiene servicios disponibles.</p>
              ) : (
                <div className="space-y-2">
                  {services.map((s) => (
                    <button key={s.id} onClick={() => { setServiceId(s.id); setStep(2); }}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-500 hover:shadow">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-1 rounded" style={{ background: s.color }} />
                        <div>
                          <div className="font-semibold text-slate-800">{s.name}</div>
                          <div className="text-xs text-slate-500">{s.description}</div>
                          <div className="mt-1 flex items-center gap-3 text-xs">
                            <span className="flex items-center gap-1 text-slate-600"><Clock className="h-3 w-3" /> {s.duration} min</span>
                            <span className="flex items-center gap-1 font-semibold text-emerald-600"><Euro className="h-3 w-3" /> {s.price}</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-400" />
                    </button>
                  ))}
                </div>
              )}
            </CardContent></Card>
          )}

          {step === 2 && (
            <Card><CardContent className="p-6">
              <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="mb-3 -ml-2 gap-1"><ArrowLeft className="h-4 w-4" /> Volver</Button>
              <h2 className="mb-4 text-lg font-semibold">Elige profesional</h2>
              <div className="grid gap-2">
                <button onClick={() => { setEmployeeId('any'); setStep(3); }}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-500 hover:shadow">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white"><Sparkles className="h-5 w-5" /></div>
                    <div><div className="font-semibold">Cualquier profesional</div><div className="text-xs text-slate-500">Reserva con el primero disponible</div></div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </button>
                {employees.map((e) => (
                  <button key={e.id} onClick={() => { setEmployeeId(e.id); setStep(3); }}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-500 hover:shadow">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: e.color }}>
                        {e.firstName?.[0]}{e.lastName?.[0]}
                      </div>
                      <div><div className="font-semibold">{e.firstName} {e.lastName}</div><div className="text-xs text-slate-500">{e.specialty}</div></div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  </button>
                ))}
              </div>
            </CardContent></Card>
          )}

          {step === 3 && (
            <Card><CardContent className="p-6">
              <Button variant="ghost" size="sm" onClick={() => setStep(2)} className="mb-3 -ml-2 gap-1"><ArrowLeft className="h-4 w-4" /> Volver</Button>
              <h2 className="mb-4 text-lg font-semibold">Elige una fecha</h2>
              <div className="grid grid-cols-7 gap-2">
                {dayOptions.map((d) => {
                  const ok = hasSlotsOnDay(d);
                  const isSelected = d.isSame(date, 'day');
                  return (
                    <button key={d.toString()} disabled={!ok}
                      onClick={() => { setDate(d); setStep(4); }}
                      className={`rounded-lg border p-2 text-center transition ${
                        isSelected ? 'border-indigo-600 bg-indigo-50' :
                        ok ? 'border-slate-200 hover:border-indigo-500 hover:bg-indigo-50' : 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                      }`}>
                      <div className="text-[10px] uppercase tracking-wider">{d.format('ddd')}</div>
                      <div className="text-lg font-bold">{d.format('DD')}</div>
                      <div className="text-[10px] text-slate-500">{d.format('MMM')}</div>
                      {!ok && <div className="text-[9px] text-slate-300">Cerrado</div>}
                    </button>
                  );
                })}
              </div>
            </CardContent></Card>
          )}

          {step === 4 && (
            <Card><CardContent className="p-6">
              <Button variant="ghost" size="sm" onClick={() => setStep(3)} className="mb-3 -ml-2 gap-1"><ArrowLeft className="h-4 w-4" /> Volver</Button>
              <h2 className="text-lg font-semibold">Elige una hora</h2>
              <p className="mb-4 text-sm text-slate-500">{dayjs(date).format('dddd D [de] MMMM YYYY')}</p>
              {slotsLoading ? (
                <div className="py-8 text-center text-sm text-slate-500">Cargando horas disponibles…</div>
              ) : availableSlots.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">
                  No hay horas disponibles este día. Prueba con otra fecha.
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 md:grid-cols-6">
                  {availableSlots.map((s) => (
                    <button key={s.start} onClick={() => { setSlot(s); setStep(5); }}
                      className="rounded-lg border border-slate-200 bg-white py-2 text-sm font-medium transition hover:border-indigo-500 hover:bg-indigo-50">
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </CardContent></Card>
          )}

          {step === 5 && slot && (
            <Card><CardContent className="p-6">
              <Button variant="ghost" size="sm" onClick={() => setStep(4)} className="mb-3 -ml-2 gap-1"><ArrowLeft className="h-4 w-4" /> Volver</Button>
              <h2 className="mb-1 text-lg font-semibold">Completa tus datos</h2>
              <p className="mb-4 text-sm text-slate-500">Para confirmar tu reserva</p>

              <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm">
                <div className="font-semibold text-slate-800">{service.name}</div>
                <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div><CalIcon className="mr-1 inline h-3 w-3" />{dayjs(slot.start).format('dddd D MMM, HH:mm')}</div>
                  <div><Clock className="mr-1 inline h-3 w-3" />{service.duration} min</div>
                  <div><User className="mr-1 inline h-3 w-3" />{employees.find((e) => e.id === slot.employeeId)?.firstName} {employees.find((e) => e.id === slot.employeeId)?.lastName}</div>
                  <div><Euro className="mr-1 inline h-3 w-3" />{service.price} €</div>
                </div>
              </div>

              {submitError && (
                <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{submitError}</div>
              )}

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Nombre *</Label><Input value={client.firstName} onChange={(e) => setClient({ ...client, firstName: e.target.value })} /></div>
                  <div><Label className="text-xs">Apellidos</Label><Input value={client.lastName} onChange={(e) => setClient({ ...client, lastName: e.target.value })} /></div>
                  <div><Label className="text-xs">Email</Label><Input type="email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} /></div>
                  <div><Label className="text-xs">Teléfono *</Label><Input value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} /></div>
                </div>
                <div><Label className="text-xs">Notas (opcional)</Label><Textarea rows={2} value={client.notes} onChange={(e) => setClient({ ...client, notes: e.target.value })} /></div>
                <div>
                  <Label className="text-xs">Método de pago</Label>
                  {svcPay?.mode === 'deposit' || svcPay?.mode === 'full' ? (
                    <div className="mt-1 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900" data-testid="book-online-required">
                      <div className="font-semibold">
                        {svcPay.mode === 'deposit' ? `Señal de ${svcPay.amount}€ para confirmar` : `Pago online de ${svcPay.amount}€`}
                      </div>
                      <div className="text-xs">
                        {svcPay.mode === 'deposit'
                          ? `Pagarás la señal ahora con tarjeta y el resto (${Math.max(0, service.price - svcPay.amount)}€) en el local.`
                          : 'Pagarás ahora con tarjeta de forma segura con Stripe.'}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setPaymentMethod('onsite')} className={`rounded-lg border p-3 text-sm transition ${paymentMethod === 'onsite' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200'}`}>
                        <div className="font-semibold">Pagar en el local</div>
                        <div className="text-xs text-slate-500">Efectivo o tarjeta</div>
                      </button>
                      <button type="button" data-testid="book-pay-online" onClick={() => setPaymentMethod('stripe')} disabled={svcPay?.mode !== 'optional'}
                        className={`rounded-lg border p-3 text-sm transition disabled:opacity-50 ${paymentMethod === 'stripe' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200'}`}>
                        <div className="font-semibold">Pagar ahora · {service.price}€</div>
                        <div className="text-xs text-slate-500">{svcPay?.mode === 'optional' ? 'Tarjeta (Stripe)' : 'No disponible'}</div>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <Button onClick={submit} disabled={submitting} className="mt-6 w-full" size="lg">
                {submitting ? 'Creando reserva...' : 'Confirmar reserva'}
              </Button>
            </CardContent></Card>
          )}

          {step === 6 && confirmedAppt && (
            <Card><CardContent className="p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-9 w-9 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold">¡Reserva confirmada!</h2>
              <p className="mt-2 text-sm text-slate-500">Te hemos enviado los detalles a tu email.</p>

              <div className="mx-auto mt-6 max-w-sm rounded-lg border bg-slate-50 p-4 text-left text-sm">
                <div className="font-semibold text-slate-800">{service.name}</div>
                <div className="mt-2 space-y-1 text-xs text-slate-600">
                  <div><CalIcon className="mr-1 inline h-3 w-3" />{dayjs(confirmedAppt.start).format('dddd D MMM YYYY, HH:mm')}</div>
                  <div><Clock className="mr-1 inline h-3 w-3" />{service.duration} minutos</div>
                  <div><User className="mr-1 inline h-3 w-3" />Con {employees.find((e) => e.id === confirmedAppt.employeeId)?.firstName} {employees.find((e) => e.id === confirmedAppt.employeeId)?.lastName}</div>
                  {tenant.address && <div><MapPin className="mr-1 inline h-3 w-3" />{tenant.address}</div>}
                </div>
              </div>

              <div className="mt-6 flex justify-center gap-2">
                <Button variant="outline" onClick={() => { setStep(1); setServiceId(null); setSlot(null); setConfirmedAppt(null); }}>Hacer otra reserva</Button>
              </div>

              <p className="mt-6 text-xs text-slate-400">Recibirás un recordatorio 24h antes de tu cita.</p>
            </CardContent></Card>
          )}
        </div>
      </div>

      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="container mx-auto px-6 text-center text-xs text-slate-400">
          Powered by <span className="font-semibold text-slate-600">Reserva360</span> · Reserva online segura
        </div>
      </footer>
    </div>
  );
}
