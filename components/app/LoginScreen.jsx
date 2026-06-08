'use client';

import { useApp } from '@/lib/supabase-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, Building2, UserRound, Calendar, Sparkles, ArrowRight, RefreshCw, Mail, LogIn, Download } from 'lucide-react';

export default function LoginScreen() {
  const { tenants, employees, login, resetDemo } = useApp();

  const activeTenants = tenants.filter((t) => t.status === 'active');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto flex items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-2">
            <img src="/logo-reserva360.png" alt="Reserva360" className="h-9 w-auto" />
          </div>
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="sm" onClick={() => { window.location.href = 'mailto:reserva360.app@gmail.com?subject=Contacto%20Reserva360'; }} className="gap-2">
              <Mail className="h-4 w-4" /> Contacto
            </Button>
            <div className="flex flex-col items-end">
              <Button size="sm" className="gap-2" onClick={() => { window.location.href = '/auth/login'; }}>
                <LogIn className="h-4 w-4" /> Iniciar sesión
              </Button>
              <a href="/auth/signup" className="mt-1 text-xs text-indigo-600 hover:underline">Crear cuenta</a>
            </div>
          </div>
        </div>
      </header>

      <section className="container mx-auto px-6 py-12">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-8 flex justify-center">
            <img
              src="/logo-reserva360.png"
              alt="Reserva360"
              className="h-32 w-auto sm:h-40 md:h-48 lg:h-56 drop-shadow-sm"
            />
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Gestione citas y reservas <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">para cualquier negocio</span>
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Fisios, peluquerías, veterinarios, barberías, nutricionistas… todo bajo una sola plataforma.
          </p>
          <p className="mt-2 text-sm text-slate-500">Elige cómo quieres explorar la demo:</p>
        </div>

        <div className="mx-auto mt-10 grid max-w-6xl gap-6 md:grid-cols-3">
          {/* Super Admin */}
          <Card className="group cursor-pointer border-2 border-transparent transition-all hover:border-indigo-500 hover:shadow-xl"
            onClick={() => login({ role: 'super_admin' })}>
            <CardHeader>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg">
                <Shield className="h-6 w-6" />
              </div>
              <CardTitle>Super Admin</CardTitle>
              <CardDescription>Dueño de la plataforma SaaS</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>• Gestionar todos los tenants</li>
                <li>• Ingresos globales y MRR</li>
                <li>• Planes y suscripciones</li>
                <li>• Impersonar cualquier tenant</li>
              </ul>
              <Button className="mt-5 w-full group-hover:bg-indigo-600">
                Entrar como Super Admin <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Tenant Admin */}
          <Card className="border-2 border-transparent hover:shadow-xl transition-all">
            <CardHeader>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
                <Building2 className="h-6 w-6" />
              </div>
              <CardTitle>Tenant Admin</CardTitle>
              <CardDescription>Propietario de un negocio</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-slate-600">Elige un negocio para entrar:</p>
              <div className="space-y-2">
                {activeTenants.map((t) => (
                  <button key={t.id}
                    onClick={() => login({ role: 'tenant_admin', tenantId: t.id })}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white p-2.5 text-left transition hover:border-emerald-500 hover:bg-emerald-50">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{t.logo}</span>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{t.name}</div>
                        <div className="text-xs text-slate-500">{t.industry}</div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Employee */}
          <Card className="border-2 border-transparent hover:shadow-xl transition-all">
            <CardHeader>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
                <UserRound className="h-6 w-6" />
              </div>
              <CardTitle>Empleado</CardTitle>
              <CardDescription>Profesional con su propia agenda</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-slate-600">Elige un empleado:</p>
              <div className="space-y-2 max-h-72 overflow-auto pr-1">
                {employees.map((e) => {
                  const tenant = tenants.find((t) => t.id === e.tenantId);
                  if (tenant?.status !== 'active') return null;
                  return (
                    <button key={e.id}
                      onClick={() => login({ role: 'employee', tenantId: e.tenantId, employeeId: e.id })}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white p-2.5 text-left transition hover:border-amber-500 hover:bg-amber-50">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full text-white text-xs font-semibold" style={{ background: e.color }}>
                          {e.firstName[0]}{e.lastName[0]}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{e.firstName} {e.lastName}</div>
                          <div className="text-xs text-slate-500">{e.specialty} · {tenant?.name}</div>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

      </section>
    </div>
  );
}
