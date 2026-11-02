// Plantillas de WhatsApp (categoría UTILITY, español). Se crean automáticamente en la cuenta YCloud
// del negocio al conectar. Meta debe aprobarlas (normalmente minutos u horas) antes de poder enviarlas.

export const TEMPLATE_LANG = 'es';

export const TEMPLATES = {
  confirmation: {
    name: 'r360_cita_confirmada',
    label: 'Confirmación de cita',
    text: 'Hola {{1}}, tu cita de {{2}} en {{3}} está confirmada para el {{4}}. Puedes cambiarla o cancelarla aquí: {{5}} o respondiendo a este mensaje.',
    example: ['María', 'Fisioterapia', 'FisioVital', 'lunes, 3 de noviembre, 10:00', 'https://reserva360.app/manage/123'],
  },
  reminder: {
    name: 'r360_recordatorio_cita',
    label: 'Recordatorio 24h',
    text: 'Hola {{1}}, te recordamos tu cita de {{2}} en {{3}} el {{4}}. Si no puedes venir, gestiona tu cita aquí: {{5}} o responde a este mensaje.',
    example: ['María', 'Fisioterapia', 'FisioVital', 'martes, 4 de noviembre, 10:00', 'https://reserva360.app/manage/123'],
  },
  rescheduled: {
    name: 'r360_cita_cambiada',
    label: 'Cita cambiada',
    text: 'Hola {{1}}, tu cita de {{2}} en {{3}} se ha cambiado al {{4}}. Puedes gestionarla aquí: {{5}} o respondiendo a este mensaje.',
    example: ['María', 'Fisioterapia', 'FisioVital', 'miércoles, 5 de noviembre, 12:00', 'https://reserva360.app/manage/123'],
  },
  cancelled: {
    name: 'r360_cita_cancelada',
    label: 'Cita cancelada',
    text: 'Hola {{1}}, tu cita de {{2}} en {{3}} del {{4}} ha sido cancelada. Si quieres reservar otra, responde a este mensaje.',
    example: ['María', 'Fisioterapia', 'FisioVital', 'lunes, 3 de noviembre, 10:00'],
  },
  business_new: {
    name: 'r360_nueva_reserva',
    label: 'Aviso al negocio',
    text: 'Nueva reserva en {{1}}: {{2}} con {{3}} el {{4}}. Cliente: {{5}}, teléfono {{6}}. Puedes verla en tu panel de Reserva360.',
    example: ['FisioVital', 'Fisioterapia', 'Antonio', 'lunes, 3 de noviembre, 10:00', 'María López', '+34600111222'],
  },
};

export function templateCreateBody(def, wabaId) {
  return {
    wabaId,
    name: def.name,
    language: TEMPLATE_LANG,
    category: 'UTILITY',
    components: [{ type: 'BODY', text: def.text, example: { body_text: [def.example] } }],
  };
}

// Meta no admite saltos de línea / tabs ni >4 espacios seguidos en parámetros
const clean = (v) => String(v ?? '-').replace(/[\n\r\t]+/g, ' ').replace(/\s{4,}/g, '   ').trim().slice(0, 300) || '-';

export function templateMessage(def, params) {
  return {
    type: 'template',
    template: {
      name: def.name,
      language: { code: TEMPLATE_LANG },
      components: [{ type: 'body', parameters: params.map((p) => ({ type: 'text', text: clean(p) })) }],
    },
  };
}
