'use client';

import { useState } from 'react';
import { AppProvider, useApp } from '@/lib/store';
import LoginScreen from '@/components/app/LoginScreen';
import Shell from '@/components/app/Shell';
import { SuperAdminDashboard, TenantDashboard } from '@/components/app/Dashboards';
import WeekCalendar from '@/components/app/WeekCalendar';
import ClientsList from '@/components/app/ClientsList';
import EmployeesList from '@/components/app/EmployeesList';
import ServicesList from '@/components/app/ServicesList';
import AppointmentsList from '@/components/app/AppointmentsList';
import PaymentsList from '@/components/app/PaymentsList';
import TenantsList from '@/components/app/TenantsList';
import PlansView from '@/components/app/PlansView';
import AnalyticsView from '@/components/app/AnalyticsView';
import SettingsView from '@/components/app/SettingsView';
import EmployeeSchedule from '@/components/app/EmployeeSchedule';

const DEFAULT_BY_ROLE = {
  super_admin: 'sa_dashboard',
  tenant_admin: 'dashboard',
  employee: 'emp_calendar',
};

function AppShell() {
  const { session, hydrated } = useApp();
  const [active, setActive] = useState(null);

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  const current = active || DEFAULT_BY_ROLE[session.role];

  return (
    <Shell active={current} setActive={setActive}>
      {renderContent(current, session)}
    </Shell>
  );
}

function renderContent(view, session) {
  // Super Admin
  if (view === 'sa_dashboard') return <SuperAdminDashboard />;
  if (view === 'sa_tenants') return <TenantsList />;
  if (view === 'sa_plans') return <PlansView />;
  if (view === 'sa_analytics') return <AnalyticsView />;

  // Tenant Admin
  if (view === 'dashboard') return <TenantDashboard tenantId={session.tenantId} />;
  if (view === 'calendar') return <WeekCalendar tenantId={session.tenantId} />;
  if (view === 'appointments') return <AppointmentsList tenantId={session.tenantId} />;
  if (view === 'clients') return <ClientsList tenantId={session.tenantId} />;
  if (view === 'employees') return <EmployeesList tenantId={session.tenantId} />;
  if (view === 'services') return <ServicesList tenantId={session.tenantId} />;
  if (view === 'payments') return <PaymentsList tenantId={session.tenantId} />;
  if (view === 'settings') return <SettingsView tenantId={session.tenantId} />;

  // Employee
  if (view === 'emp_calendar') return <WeekCalendar tenantId={session.tenantId} employeeFilter={session.employeeId} lockEmployee />;
  if (view === 'emp_appointments') return <AppointmentsList tenantId={session.tenantId} lockEmployeeId={session.employeeId} />;
  if (view === 'emp_clients') return <ClientsList tenantId={session.tenantId} />;
  if (view === 'emp_schedule') return <EmployeeSchedule employeeId={session.employeeId} />;

  return <div>Sin contenido</div>;
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
