import { NextResponse } from 'next/server';
import { getSessionProfile } from '@/lib/auth-server';
import { ensurePrices, ensureWebhooks } from '@/lib/billing-server';
import { getBaseUrl } from '@/lib/base-url';
import { errorResponse } from '@/lib/route-helpers';

export const dynamic = 'force-dynamic';

// Solo Super Admin: crea (si faltan) los productos/precios de Stripe y los webhooks para esta URL
export async function POST(request) {
  const s = await getSessionProfile();
  if (!s || s.profile.role !== 'super_admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const prices = await ensurePrices();
    const webhooks = await ensureWebhooks(s.admin, getBaseUrl(request));
    return NextResponse.json({ ok: true, prices, webhooks });
  } catch (e) {
    return errorResponse(e);
  }
}
