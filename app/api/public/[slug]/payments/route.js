import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { onlinePaymentsEnabled, paymentAmountFor } from '@/lib/billing-server';

export const dynamic = 'force-dynamic';

// Configuración pública de pagos online del negocio (para la página de reservas)
export async function GET(_request, { params }) {
  const { slug } = await params;
  const supabase = createSupabaseAdminClient();
  const { data: tenant } = await supabase.from('tenants').select('*').eq('slug', slug).maybeSingle();
  if (!tenant) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });
  const enabled = onlinePaymentsEnabled(tenant);
  const services = {};
  if (enabled) {
    const { data } = await supabase.from('services').select('*').eq('tenant_id', tenant.id).eq('active', true);
    for (const s of data || []) {
      const mode = s.payment_mode || 'onsite';
      const amount = paymentAmountFor(s);
      services[s.id] = { mode: mode !== 'onsite' && amount > 0 ? mode : 'onsite', amount };
    }
  }
  return NextResponse.json({ enabled, services });
}
