// Normalización de teléfonos a formato internacional E.164 (+34600111222)

export function normalizePhone(raw, defaultCountryCode = '34') {
  if (!raw) return null;
  let s = String(raw).trim().replace(/[\s\-().]/g, '');
  if (!s) return null;
  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  if (!s.startsWith('+')) {
    const cc = String(defaultCountryCode || '34').replace(/\D/g, '');
    s = s.startsWith(cc) && s.length > 10 ? `+${s}` : `+${cc}${s}`;
  }
  const digits = s.slice(1).replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

export const phoneDigits = (p) => String(p || '').replace(/\D/g, '');

// Dos teléfonos son el mismo si coinciden los últimos 9 dígitos
export function samePhone(a, b) {
  const da = phoneDigits(a);
  const db = phoneDigits(b);
  if (da.length < 6 || db.length < 6) return false;
  return da.slice(-9) === db.slice(-9);
}

// Busca clientes del negocio con ese teléfono (tolera espacios y prefijos distintos)
export async function findClientsByPhone(supabase, tenantId, phone) {
  const d = phoneDigits(phone);
  if (d.length < 6) return [];
  const { data } = await supabase
    .from('clients')
    .select('id, first_name, last_name, email, phone')
    .eq('tenant_id', tenantId)
    .ilike('phone', `%${d.slice(-3)}%`)
    .limit(200);
  return (data || []).filter((c) => samePhone(c.phone, phone));
}
