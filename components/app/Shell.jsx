'use client';

import { useApp } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Calendar, LayoutDashboard, Users, Briefcase, UserRound, Settings, LogOut, BarChart3, CreditCard, Building2, Shield, ChevronDown, RefreshCw, Bell, X } from 'lucide-react';

const SIDEBAR_BY_ROLE = {
  super_admin: [
    { id: 'sa_dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'sa_tenants', label: 'Tenants', icon: Building2 },
    { id: 'sa_plans', label: 'Planes', icon: CreditCard },
    { id: 'sa_analytics', label: 'Analíticas', icon: BarChart3 },
  ],
  tenant_admin: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'calendar', label: 'Calendario', icon: Calendar },
    { id: 'appointments', label: 'Reservas', icon: Briefcase },
    { id: 'clients', label: 'Clientes', icon: Users },
    { id: 'employees', label: 'Empleados', icon: UserRound },
    { id: 'services', label: 'Servicios', icon: Briefcase },
    { id: 'payments', label: 'Pagos', icon: CreditCard },
    { id: 'settings', label: 'Configuración', icon: Settings },
  ],
  employee: [
    { id: 'emp_calendar', label: 'Mi calendario', icon: Calendar },
    { id: 'emp_appointments', label: 'Mis citas', icon: Briefcase },
    { id: 'emp_clients', label: 'Mis clientes', icon: Users },
    { id: 'emp_schedule', label: 'Mis horarios', icon: Settings },
  ],
};

export default function Shell({ active, setActive, children }) {
  const { session, logout, tenants, employees, stopImpersonating, resetDemo } = useApp();
  const tenant = tenants.find((t) => t.id === session?.tenantId);
  const employee = employees.find((e) => e.id === session?.employeeId);
  const items = SIDEBAR_BY_ROLE[session?.role] || [];

  const roleLabel = {
    super_admin: 'Super Admin',
    tenant_admin: 'Tenant Admin',
    employee: 'Empleado',
  }[session?.role];

  const roleColor = {
    super_admin: 'from-indigo-500 to-violet-600',
    tenant_admin: 'from-emerald-500 to-teal-600',
    employee: 'from-amber-500 to-orange-600',
  }[session?.role];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${roleColor} text-white shadow-md`}>
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold leading-tight tracking-tight">Bookly</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{roleLabel}</div>
          </div>
        </div>

        {tenant && (
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-xl">{tenant.logo}</span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-800">{tenant.name}</div>
                <div className="text-xs text-slate-500">{tenant.industry}</div>
              </div>
            </div>
          </div>
        )}

        <nav className="flex-1 space-y-0.5 p-3">
          {items.map((it) => {
            const Icon = it.icon;
            const isActive = active === it.id;
            return (
              <button key={it.id} onClick={() => setActive(it.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  isActive ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}>
                <Icon className="h-4 w-4" /> {it.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <Button variant="ghost" size="sm" onClick={resetDemo} className="w-full justify-start gap-2 text-slate-500">
            <RefreshCw className="h-4 w-4" /> Resetear datos demo
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {session?.impersonatedBy && (
          <div className="flex items-center justify-between bg-amber-100 px-5 py-2 text-xs text-amber-900">
            <span className="flex items-center gap-2"><Shield className="h-3.5 w-3.5" /> Estás impersonando como Tenant Admin de <b>{tenant?.name}</b></span>
            <Button size="sm" variant="outline" className="h-6 gap-1 border-amber-400 bg-white text-amber-900" onClick={stopImpersonating}>
              <X className="h-3 w-3" /> Dejar de impersonar
            </Button>
          </div>
        )}

        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-800">
              {items.find((i) => i.id === active)?.label || 'Bookly'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-500" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 pr-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className={`bg-gradient-to-br ${roleColor} text-xs text-white`}>
                      {employee ? `${employee.firstName[0]}${employee.lastName[0]}` : session?.role?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden text-left sm:block">
                    <div className="text-xs font-semibold text-slate-800">{employee ? `${employee.firstName} ${employee.lastName}` : roleLabel}</div>
                    <div className="text-[10px] text-slate-500">{tenant?.name || 'Plataforma'}</div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Sesión demo</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-rose-600">
                  <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
