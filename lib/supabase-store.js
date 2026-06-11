'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const AppCtx = createContext(null);

// Mapeo de campos DB ↔ UI (snake_case ↔ camelCase para appointments y otros)
const fromApptDB = (a) => ({
  id: a.id,
  tenantId: a.tenant_id,
  employeeId: a.employee_id,
  clientId: a.client_id,
  serviceId: a.service_id,
  start: a.start_at,
  end: a.end_at,
  status: a.status,
  notes: a.notes,
  source: a.source,
  payment: {
    status: a.payment_status,
    amount: a.payment_amount != null ? Number(a.payment_amount) : null,
    method: a.payment_method,
  },
});

const toApptDB = (a) => ({
  tenant_id: a.tenantId,
  employee_id: a.employeeId,
  client_id: a.clientId,
  service_id: a.serviceId,
  start_at: a.start,
  end_at: a.end,
  status: a.status,
  notes: a.notes,
  source: a.source || 'admin',
  payment_status: a.payment?.status || 'pending',
  payment_amount: a.payment?.amount,
  payment_method: a.payment?.method || 'onsite',
});

const fromEmpDB = (e) => ({
  id: e.id, tenantId: e.tenant_id,
  firstName: e.first_name, lastName: e.last_name,
  email: e.email, phone: e.phone,
  specialty: e.specialty, avatar: e.avatar_url,
  color: e.color, schedule: e.schedule, active: e.active,
});

const toEmpDB = (e) => ({
  tenant_id: e.tenantId,
  first_name: e.firstName, last_name: e.lastName,
  email: e.email, phone: e.phone,
  specialty: e.specialty, avatar_url: e.avatar,
  color: e.color, schedule: e.schedule, active: e.active,
});

const fromSvcDB = (s) => ({
  id: s.id, tenantId: s.tenant_id,
  name: s.name, description: s.description,
  duration: s.duration_minutes, price: Number(s.price),
  color: s.color, active: s.active,
});

const toSvcDB = (s) => ({
  tenant_id: s.tenantId,
  name: s.name, description: s.description,
  duration_minutes: s.duration, price: s.price,
  color: s.color, active: s.active,
});

const fromCliDB = (c) => ({
  id: c.id, tenantId: c.tenant_id,
  firstName: c.first_name, lastName: c.last_name,
  email: c.email, phone: c.phone,
  notes: c.notes, createdAt: c.created_at,
});

const toCliDB = (c) => ({
  tenant_id: c.tenantId,
  first_name: c.firstName, last_name: c.lastName,
  email: c.email, phone: c.phone,
  notes: c.notes,
});

const fromTenantDB = (t) => ({
  id: t.id, slug: t.slug, name: t.name, industry: t.industry,
  logo: t.logo, color: t.color, email: t.email, phone: t.phone,
  address: t.address, plan: t.plan_id, status: t.status,
  mrr: Number(t.mrr || 0), businessHours: t.business_hours,
  vacations: t.vacations, createdAt: t.created_at,
});

const toTenantDB = (t) => ({
  slug: t.slug, name: t.name, industry: t.industry, logo: t.logo,
  color: t.color, email: t.email, phone: t.phone, address: t.address,
  plan_id: t.plan, status: t.status, mrr: t.mrr,
  business_hours: t.businessHours, vacations: t.vacations,
});

export function SupabaseAppProvider({ initialProfile, initialTenant, children }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [session] = useState(() => ({
    role: initialProfile?.role || 'tenant_admin',
    tenantId: initialProfile?.tenant_id || initialTenant?.id || null,
    employeeId: initialProfile?.employee_id || null,
  }));

  const [tenants, setTenants] = useState(initialTenant ? [fromTenantDB(initialTenant)] : []);
  const [employees, setEmployees] = useState([]);
  const [services, setServices] = useState([]);
  const [clients, setClients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [plans, setPlans] = useState([]);
  const [activity] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  const tenantId = session.tenantId;

  const refresh = useCallback(async () => {
    const isSuper = session.role === 'super_admin';
    if (!tenantId && !isSuper) { setHydrated(true); return; }

    if (isSuper) {
      // Super admin: fetch global data (todos los tenants, todas las citas, planes)
      const [ten, app, pl, cli] = await Promise.all([
        supabase.from('tenants').select('*'),
        supabase.from('appointments').select('*').order('start_at', { ascending: false }).limit(500),
        supabase.from('plans').select('*'),
        supabase.from('clients').select('*'),
      ]);
      setTenants((ten.data || []).map(fromTenantDB));
      setAppointments((app.data || []).map(fromApptDB));
      setClients((cli.data || []).map(fromCliDB));
      setPlans((pl.data || []).map((p) => ({
        id: p.id, name: p.name, price: Number(p.price), currency: p.currency, interval: p.interval, features: p.features,
      })));
      setHydrated(true);
      return;
    }

    const [emp, svc, cli, app, pl, ten] = await Promise.all([
      supabase.from('employees').select('*').eq('tenant_id', tenantId),
      supabase.from('services').select('*').eq('tenant_id', tenantId),
      supabase.from('clients').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
      supabase.from('appointments').select('*').eq('tenant_id', tenantId).order('start_at', { ascending: false }).limit(500),
      supabase.from('plans').select('*'),
      supabase.from('tenants').select('*').eq('id', tenantId),
    ]);
    setEmployees((emp.data || []).map(fromEmpDB));
    setServices((svc.data || []).map(fromSvcDB));
    setClients((cli.data || []).map(fromCliDB));
    setAppointments((app.data || []).map(fromApptDB));
    setPlans((pl.data || []).map((p) => ({
      id: p.id, name: p.name, price: Number(p.price), currency: p.currency, interval: p.interval, features: p.features,
    })));
    setTenants((ten.data || []).map(fromTenantDB));
    setHydrated(true);
  }, [supabase, tenantId, session.role]);

  useEffect(() => { refresh(); }, [refresh]);

  // Helpers comunes
  const byTenant = (collection, tid) => {
    const map = { employees, services, clients, appointments };
    return (map[collection] || []).filter((x) => x.tenantId === tid);
  };

  // CRUD generic factory
  const makeCrud = (collection, table, toDB, fromDB, setLocal, localList) => ({
    add: async (item) => {
      const payload = toDB(item);
      const { data, error } = await supabase.from(table).insert(payload).select().single();
      if (error) { console.error(error); return; }
      setLocal((prev) => [fromDB(data), ...prev]);
    },
    update: async (id, patch) => {
      // Necesitamos el item actual para construir el payload completo
      const current = localList.find((x) => x.id === id);
      const merged = { ...current, ...patch };
      const payload = toDB(merged);
      const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single();
      if (error) { console.error(error); throw error; }
      setLocal((prev) => prev.map((x) => x.id === id ? fromDB(data) : x));
      return fromDB(data);
    },
    remove: async (id) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) { console.error(error); return; }
      setLocal((prev) => prev.filter((x) => x.id !== id));
    },
  });

  const employeesApi = useMemo(() => makeCrud('employees', 'employees', toEmpDB, fromEmpDB, setEmployees, employees), [supabase, employees]);
  const servicesApi = useMemo(() => makeCrud('services', 'services', toSvcDB, fromSvcDB, setServices, services), [supabase, services]);
  const clientsApi = useMemo(() => makeCrud('clients', 'clients', toCliDB, fromCliDB, setClients, clients), [supabase, clients]);
  const appointmentsApi = useMemo(() => makeCrud('appointments', 'appointments', toApptDB, fromApptDB, setAppointments, appointments), [supabase, appointments]);

  const updateTenant = useCallback(async (id, patch) => {
    const current = tenants.find((t) => t.id === id);
    const merged = { ...current, ...patch };
    const { data, error } = await supabase.from('tenants').update(toTenantDB(merged)).eq('id', id).select().single();
    if (error) { console.error(error); return; }
    setTenants((prev) => prev.map((t) => t.id === id ? fromTenantDB(data) : t));
  }, [supabase, tenants]);

  const addTenant = useCallback(async (t) => {
    const { data, error } = await supabase.from('tenants').insert(toTenantDB(t)).select().single();
    if (error) { console.error(error); return; }
    setTenants((prev) => [fromTenantDB(data), ...prev]);
  }, [supabase]);

  const value = {
    tenants, employees, services, clients, appointments, plans, activity,
    hydrated, session,
    employeesApi, servicesApi, clientsApi, appointmentsApi,
    byTenant, addTenant, updateTenant,
    refresh,
    login: () => {}, logout: () => { window.location.href = '/api/auth/logout'; },
    impersonate: () => {}, stopImpersonating: () => {},
    resetDemo: () => {},
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be inside SupabaseAppProvider');
  return ctx;
}
