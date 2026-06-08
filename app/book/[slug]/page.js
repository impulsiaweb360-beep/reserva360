'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import dayjs from 'dayjs';
import { AppProvider, useApp } from '@/lib/store';
import { getAvailableSlots, getWorkingWindows } from '@/lib/booking';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, Clock, Euro, Calendar as CalIcon, User, ChevronRight, ArrowLeft, MapPin, Phone, Mail, Sparkles, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';

function BookFlow() {
  const params = useParams();
  const slug = params?.slug;
  const { tenants, byTenant, appointments, appointmentsApi, clientsApi, hydrated } = useApp();

  const tenant = tenants.find((t) => t.slug === slug);

  const [step, setStep] = useState(1); // 1 servicio · 2 empleado · 3 fecha · 4 hora · 5 datos · 6 confirmación
  const [serviceId, setServiceId] = useState(null);
  const [employeeId, setEmployeeId] = useState('any');
  const [date, setDate] = useState(dayjs().add(1, 'day').startOf('day'));
  const [slot, setSlot] = useState(null);
  const [client, setClient] = useState({ firstName: '', lastName: '', email: '', phone: '', notes: '' });
  const [paymentMethod, setPaymentMethod] = useState('onsite');
  const [confirmedAppt, setConfirmedAppt] = useState(null);

  const services = useMemo(() => tenant ? byTenant('services', tenant.id).filter((s) => s.active !== false) : [], [tenant, byTenant]);
  const employees = useMemo(() => tenant ? byTenant('employees', tenant.id).filter((e) => e.active !== false) : [], [tenant, byTenant]);
  const service = services.find((s) => s.id === serviceId);

  // Lista de empleados elegibles
  const eligibleEmployees = employees;

  // Slots disponibles del día seleccionado (uniendo todos los empleados si "any")
  const availableSlots = useMemo(() => {
    if (!service || !tenant) return [];
    const empList = employeeId === 'any' ? eligibleEmployees : eligibleEmployees.filter((e) => e.id === employeeId);
    const all = [];
    const seen = new Set();
    empList.forEach((emp) => {
      const slots = getAvailableSlots({ date, service, employee: emp, tenant, appointments });
      slots.forEach((s) => {
        const key = s.label;
        if (!seen.has(key)) {
          seen.add(key);
          all.push({ ...s, employeeId: emp.id });
        }
      });
    });
    return all.sort((a, b) => a.label.localeCompare(b.label));
  }, [date, service, employeeId, eligibleEmployees, tenant, appointments]);

  // Calendario mini: días seleccionables (próximos 30)
  const dayOptions = useMemo(() => Array.from({ length: 14 }, (_, i) => dayjs().startOf('day').add(i, 'day')), []);
  const hasSlotsOnDay = (d) => {
    if (!service) return false;
    const empList = employeeId === 'any' ? eligibleEmployees : eligibleEmployees.filter((e) => e.id === employeeId);
    return empList.some((emp) => getWorkingWindows(d, tenant, emp).length > 0);
  };

  const submit = () => {
    if (!client.firstName || !client.phone) {
      toast.error('Nombre y teléfono son obligatorios');
      return;
    }
    const clientId = `c_${Date.now()}`;
    clientsApi.add({ id: clientId, tenantId: tenant.id, ...client, createdAt: new Date().toISOString() });

    const start = dayjs(slot.start);
    const end = start.add(service.duration, 'minute');
    const id = `a_${Date.now()}`;
    const newAppt = {
      id,
      tenantId: tenant.id,
      employeeId: slot.employeeId,
      clientId,
      serviceId: service.id,
      start: start.toISOString(),
      end: end.toISOString(),
      status: 'confirmed',
      notes: client.notes,
      source: 'online',
      payment: { status: paymentMethod === 'stripe' ? 'paid' : 'pending', amount: service.price, method: paymentMethod },
    };
    appointmentsApi.add(newAppt);
    setConfirmedAppt(newAppt);
    setStep(6);
  };

  if (!hydrated) {
    return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" /></div>;
  }

  if (!tenant) {
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

  if (tenant.status !== 'active') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="max-w-md"><CardContent className="p-8 text-center">
          <div className="mb-3 text-5xl">⏸</div>
          <h1 className="text-xl font-bold">{tenant.name}</h1>
          <p className="mt-2 text-sm text-slate-500">La página de reservas online está temporalmente desactivada.</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      {/* Hero */}
      <header className="border-b border-slate-200 bg-white">
        <div className="container mx-auto flex flex-col items-start gap-3 px-6 py-6 md:flex-row md:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-3xl shadow" style={{ background: `${tenant.color}15`, border: `2px solid ${tenant.color}30` }}>
            {tenant.logo}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{tenant.name}</h1>
            <p className="text-sm text-slate-500">{tenant.industry}</p>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
              {tenant.address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{tenant.address}</span>}
              {tenant.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{tenant.phone}</span>}
              {tenant.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{tenant.email}</span>}
            </div>
          </div>
          <Badge style={{ background: `${tenant.color}20`, color: tenant.color }} className="border-0">
            <Sparkles className="mr-1 h-3 w-3" /> Reserva online
          </Badge>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Stepper */}
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
          {/* PASO 1: Servicio */}
          {step === 1 && (
            <Card>
              <CardContent className="p-6">
                <h2 className="mb-4 text-lg font-semibold">Elige un servicio</h2>
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
              </CardContent>
            </Card>
          )}

          {/* PASO 2: Empleado */}
          {step === 2 && (
            <Card>
              <CardContent className="p-6">
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
                  {eligibleEmployees.map((e) => (
                    <button key={e.id} onClick={() => { setEmployeeId(e.id); setStep(3); }}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-500 hover:shadow">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: e.color }}>
                          {e.firstName[0]}{e.lastName[0]}
                        </div>
                        <div><div className="font-semibold">{e.firstName} {e.lastName}</div><div className="text-xs text-slate-500">{e.specialty}</div></div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-400" />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* PASO 3: Fecha */}
          {step === 3 && (
            <Card>
              <CardContent className="p-6">
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
              </CardContent>
            </Card>
          )}

          {/* PASO 4: Hora */}
          {step === 4 && (
            <Card>
              <CardContent className="p-6">
                <Button variant="ghost" size="sm" onClick={() => setStep(3)} className="mb-3 -ml-2 gap-1"><ArrowLeft className="h-4 w-4" /> Volver</Button>
                <h2 className="text-lg font-semibold">Elige una hora</h2>
                <p className="mb-4 text-sm text-slate-500">{dayjs(date).format('dddd D [de] MMMM YYYY')}</p>
                {availableSlots.length === 0 ? (
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
              </CardContent>
            </Card>
          )}

          {/* PASO 5: Datos cliente */}
          {step === 5 && slot && (
            <Card>
              <CardContent className="p-6">
                <Button variant="ghost" size="sm" onClick={() => setStep(4)} className="mb-3 -ml-2 gap-1"><ArrowLeft className="h-4 w-4" /> Volver</Button>
                <h2 className="mb-1 text-lg font-semibold">Completa tus datos</h2>
                <p className="mb-4 text-sm text-slate-500">Para confirmar tu reserva</p>

                <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm">
                  <div className="font-semibold text-slate-800">{service.name}</div>
                  <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div><CalIcon className="mr-1 inline h-3 w-3" />{dayjs(slot.start).format('dddd D MMM, HH:mm')}</div>
                    <div><Clock className="mr-1 inline h-3 w-3" />{service.duration} min</div>
                    <div><User className="mr-1 inline h-3 w-3" />{eligibleEmployees.find((e) => e.id === slot.employeeId)?.firstName} {eligibleEmployees.find((e) => e.id === slot.employeeId)?.lastName}</div>
                    <div><Euro className="mr-1 inline h-3 w-3" />{service.price} €</div>
                  </div>
                </div>

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
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      <button onClick={() => setPaymentMethod('onsite')} className={`rounded-lg border p-3 text-sm transition ${paymentMethod === 'onsite' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200'}`}>
                        <div className="font-semibold">Pagar en el local</div>
                        <div className="text-xs text-slate-500">Efectivo o tarjeta</div>
                      </button>
                      <button onClick={() => setPaymentMethod('stripe')} className={`rounded-lg border p-3 text-sm transition ${paymentMethod === 'stripe' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200'}`}>
                        <div className="font-semibold">Pagar ahora · {service.price}€</div>
                        <div className="text-xs text-slate-500">Stripe (demo)</div>
                      </button>
                    </div>
                  </div>
                </div>

                <Button onClick={submit} className="mt-6 w-full" size="lg">
                  Confirmar reserva
                </Button>
              </CardContent>
            </Card>
          )}

          {/* PASO 6: Confirmación */}
          {step === 6 && confirmedAppt && (
            <Card>
              <CardContent className="p-8 text-center">
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
                    <div><User className="mr-1 inline h-3 w-3" />Con {eligibleEmployees.find((e) => e.id === confirmedAppt.employeeId)?.firstName} {eligibleEmployees.find((e) => e.id === confirmedAppt.employeeId)?.lastName}</div>
                    <div><MapPin className="mr-1 inline h-3 w-3" />{tenant.address}</div>
                  </div>
                </div>

                <div className="mt-6 flex justify-center gap-2">
                  <Button variant="outline" onClick={() => { setStep(1); setServiceId(null); setSlot(null); setConfirmedAppt(null); }}>Hacer otra reserva</Button>
                </div>

                <p className="mt-6 text-xs text-slate-400">Recibirás un recordatorio 24h y 2h antes de tu cita.</p>
              </CardContent>
            </Card>
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

export default function BookPage() {
  return (
    <AppProvider>
      <BookFlow />
    </AppProvider>
  );
}
