'use client';

import { useEffect } from 'react';
import { useApp } from '@/lib/supabase-store';
import { trackOnce } from '@/lib/analytics';

// Hitos de activación del negocio para la analítica (una vez por navegador). Sin datos personales.
export default function ConversionTracker({ tenantId }) {
  const { byTenant, hydrated } = useApp();
  const services = tenantId ? byTenant('services', tenantId) : [];
  const employees = tenantId ? byTenant('employees', tenantId) : [];
  const appointments = tenantId ? byTenant('appointments', tenantId) : [];
  const hasSetup = services.length > 0 && employees.length > 0;
  const hasOnline = appointments.some((a) => a.source === 'online' || a.source === 'whatsapp');

  useEffect(() => {
    if (!hydrated || !tenantId) return;
    if (hasSetup) trackOnce(`setup_${tenantId}`, 'business_setup_complete', { services_count: services.length, employees_count: employees.length });
    if (hasOnline) trackOnce(`first_booking_${tenantId}`, 'first_booking_received', {});
    // eslint-disable-next-line
  }, [hydrated, tenantId, hasSetup, hasOnline]);

  return null;
}
