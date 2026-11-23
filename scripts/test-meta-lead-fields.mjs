// Prueba de SOLO LECTURA contra Meta: comprueba que la descarga de un lead real funciona con los campos
// exactos que usa el webhook (LEAD_FIELDS) y que el mapeo extrae email/nombre/teléfono.
// No escribe en Supabase ni en Meta. No imprime tokens ni datos personales (solo códigos y presencia de campos).
// Uso: bundle con esbuild + node, con META_PAGE_ID y META_PAGE_ACCESS_TOKEN en el entorno.
import { graph, metaConfig, mapMetaLead, LEAD_FIELDS } from '@/lib/crm/meta';

const cfg = metaConfig();
const m = (x) => (x ? `…${String(x).slice(-4)}` : x);
let pass = 0, fail = 0;
const ok = (c, msg, extra = '') => { if (c) { pass++; console.log('✅', msg); } else { fail++; console.log('❌', msg, extra); } };

try {
  ok(!LEAD_FIELDS.split(',').includes('page_id'), 'LEAD_FIELDS no incluye «page_id» (no existe en el objeto Lead)');
  const forms = await graph(`${cfg.pageId}/leadgen_forms`, { params: { fields: 'id,name,status', limit: 50 }, token: cfg.pageToken, cfg });
  ok((forms.data || []).length > 0, `Formularios en la Página: ${(forms.data || []).length}`);
  let tested = 0;
  for (const f of forms.data || []) {
    const leads = await graph(`${f.id}/leads`, { params: { fields: 'id', limit: 3 }, token: cfg.pageToken, cfg });
    for (const l of leads.data || []) {
      tested++;
      try {
        const lead = await graph(l.id, { params: { fields: LEAD_FIELDS }, token: cfg.pageToken, cfg });
        ok(true, `Descarga del lead ${m(l.id)} («${f.name}») con LEAD_FIELDS → 200`);
        const mm = mapMetaLead(lead);
        const fl = mm.fields || {};
        // La Lead Ads Testing Tool rellena «<test lead: dummy data for …>»: un teléfono sin dígitos debe quedar vacío
        const rawPhone = String((lead.field_data || []).find((x) => x.name === 'phone_number')?.values?.[0] || '');
        const phoneExpected = /\d{6,}/.test(rawPhone);
        ok(Boolean(fl.email) && Boolean(fl.first_name || fl.last_name) && Boolean(fl.phone) === phoneExpected,
          `Mapeo del lead ${m(l.id)}: email=${Boolean(fl.email)} nombre=${Boolean(fl.first_name || fl.last_name)} teléfono=${Boolean(fl.phone)} (esperado ${phoneExpected}${/^<test lead/i.test(rawPhone) ? ', dato ficticio de la Testing Tool' : ''}) · formulario ${m(lead.form_id)}`);
      } catch (e) {
        ok(false, `Descarga del lead ${m(l.id)} con LEAD_FIELDS`, e?.message);
      }
    }
  }
  ok(tested > 0, `Leads reales probados: ${tested}`);
} catch (e) {
  fail++; console.log('❌ EXCEPCIÓN', e?.message);
}
console.log(`\nRESULTADO ${pass}/${pass + fail}`);
