import { NextResponse } from 'next/server';
import { getSessionProfile } from '@/lib/auth-server';
import { notifyAppointment } from '@/lib/whatsapp/notify';
import { getBaseUrl } from '@/lib/base-url';

export const dynamic = 'force-dynamic';

// Llamado desde el panel cuando el negocio crea, cambia o cancela una cita
export async function POST(request) {
  const s = await getSessionProfile();
  if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { appointment_id, event } = await request.json().catch(() => ({}));
  if (!appointment_id || !['created', 'rescheduled', 'cancelled'].includes(event)) {
    return NextResponse.json({ error: 'Parámetros no válidos' }, { status: 400 });
  }
  const { data: appt } = await s.admin.from('appointments').select('id, tenant_id, start_at').eq('id', appointment_id).maybeSingle();
  if (!appt) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
  if (s.profile.role !== 'super_admin' && s.profile.tenant_id !== appt.tenant_id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  // No se avisa de citas cuya hora ya ha pasado (el enlace para cambiarla no serviría)
  if (new Date(appt.start_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: true, skipped: 'past_appointment' });
  }
  const result = await notifyAppointment(s.admin, appt.id, event, { baseUrl: getBaseUrl(request), notifyBusiness: false });
  return NextResponse.json({ ok: true, result });
}
