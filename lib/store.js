'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { TENANTS, EMPLOYEES, SERVICES, CLIENTS, APPOINTMENTS, PLANS, ACTIVITY_LOG } from './mockData';

const AppCtx = createContext(null);

const LS_KEY = 'bookly_demo_state_v1';

const initialState = () => ({
  tenants: TENANTS,
  employees: EMPLOYEES,
  services: SERVICES,
  clients: CLIENTS,
  appointments: APPOINTMENTS,
  plans: PLANS,
  activity: ACTIVITY_LOG,
});

const loadState = () => {
  if (typeof window === 'undefined') return initialState();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw);
    // Always merge plans fresh
    return { ...initialState(), ...parsed };
  } catch {
    return initialState();
  }
};

export function AppProvider({ children }) {
  const [state, setState] = useState(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [session, setSession] = useState(null); // { role, tenantId?, employeeId?, impersonatedBy? }

  useEffect(() => {
    setState(loadState());
    try {
      const s = localStorage.getItem('bookly_session_v1');
      if (s) setSession(JSON.parse(s));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
  }, [state, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (session) localStorage.setItem('bookly_session_v1', JSON.stringify(session));
      else localStorage.removeItem('bookly_session_v1');
    } catch {}
  }, [session, hydrated]);

  // ===== Actions =====
  const login = useCallback((s) => setSession(s), []);
  const logout = useCallback(() => setSession(null), []);
  const stopImpersonating = useCallback(() => {
    setSession((prev) => prev?.impersonatedBy ? { role: 'super_admin' } : prev);
  }, []);
  const impersonate = useCallback((tenantId) => {
    setSession({ role: 'tenant_admin', tenantId, impersonatedBy: 'super_admin' });
  }, []);

  const resetDemo = useCallback(() => {
    const fresh = initialState();
    setState(fresh);
    try { localStorage.setItem(LS_KEY, JSON.stringify(fresh)); } catch {}
  }, []);

  // Tenants
  const addTenant = useCallback((t) => {
    setState((s) => ({ ...s, tenants: [...s.tenants, { id: `t_${Date.now()}`, status: 'active', createdAt: new Date().toISOString(), mrr: 0, ...t }] }));
  }, []);
  const updateTenant = useCallback((id, patch) => {
    setState((s) => ({ ...s, tenants: s.tenants.map((t) => t.id === id ? { ...t, ...patch } : t) }));
  }, []);

  // Generic CRUD by collection
  const crud = (collection) => ({
    add: (item) => setState((s) => ({ ...s, [collection]: [...s[collection], { id: `${collection.slice(0,2)}_${Date.now()}`, ...item }] })),
    update: (id, patch) => setState((s) => ({ ...s, [collection]: s[collection].map((x) => x.id === id ? { ...x, ...patch } : x) })),
    remove: (id) => setState((s) => ({ ...s, [collection]: s[collection].filter((x) => x.id !== id) })),
  });

  const employeesApi = useMemo(() => crud('employees'), []);
  const servicesApi = useMemo(() => crud('services'), []);
  const clientsApi = useMemo(() => crud('clients'), []);
  const appointmentsApi = useMemo(() => crud('appointments'), []);

  // Selectors (multi-tenant isolation)
  const byTenant = (collection, tenantId) => state[collection].filter((x) => x.tenantId === tenantId);

  const value = {
    ...state,
    hydrated,
    session,
    login,
    logout,
    impersonate,
    stopImpersonating,
    resetDemo,
    addTenant,
    updateTenant,
    employeesApi,
    servicesApi,
    clientsApi,
    appointmentsApi,
    byTenant,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
