# Reserva360 — PRD (resumen)
SaaS multi-tenant de reservas (Next.js 14 + Supabase + Stripe + Resend + YCloud WhatsApp). Idioma: español.

## Programa de Usuarios Fundadores (nov 2026)
- 30 % de descuento durante 3 ciclos de facturación PAGADOS en Pro (19,99 €) y Business (39,99 €): 13,99 € / 27,99 € al mes.
  En pago anual: 30 % el primer año (154 € / 308 €), que cuenta como los 3 ciclos.
- Requisitos (datos reales, SQL founder_requirements): negocio creado antes del lanzamiento, con propietario (tenant_admin),
  nombre + teléfono + dirección, ≥1 servicio activo, horario con algún día abierto, ≥1 profesional activo.
- La elegibilidad se congela en la fecha de lanzamiento (founder_program.launch_at). En esa fecha el modo lanzamiento (Pro gratis) se cierra solo.
- Un negocio = un único beneficio: founder_benefits.tenant_id UNIQUE + trigger guard + bloqueo de fila en claim/activate + ciclos UNIQUE por factura.
- Se activa en el primer checkout de Pro/Business (cupón Stripe r360_fundador_30). invoice.paid cuenta los ciclos; tras el 3.º se retira el cupón.
- Si cancela durante la promoción, pierde el descuento. Al cambiar entre Pro y Business conserva el descuento y los ciclos.
- Panel del negocio: "Mi beneficio fundador". Super Admin: Growth Engine → Usuarios Fundadores (configuración, filtros, búsqueda, historial, auditoría, correcciones).
- Migración: public/migration-fundadores.sql (YA EJECUTADA). Pruebas: scripts/test-fundadores.mjs (33/33; cambia launch_at temporalmente: usar solo con permiso).
- Tarea programada: .emergent/crons.yml → /api/cron/founders cada 15 min (Bearer WEBHOOK_CRON_SECRET o ?secret=CRON_SECRET).

## CRM Comercial (Fase 2, nov 2026)
- Super Admin → Growth Engine → CRM Comercial: Dashboard (cifras reales), Leads (búsqueda, filtros, orden, paginación, CSV), Pipeline Kanban (11 etapas; arrastrar o menú "Mover a"), Tareas, Actividades, ficha del lead.
- Tablas nuevas (migration-crm.sql, YA EJECUTADA): crm_leads, crm_activities y crm_stage_history (solo se añade), crm_tasks, crm_privacy_requests, crm_suppressions (hash). Lectura RLS solo para super_admin; escritura solo desde el servidor.
- Sincronización de solo lectura con tenants: crea un lead por negocio registrado (source app_signup, vinculado) y ajusta la etapa a Registro FREE / Cliente PRO / Cliente Business según la suscripción real. Si hay coincidencia ambigua, queda para revisión manual. Nunca modifica tenants, planes ni pagos.
- RGPD: base jurídica, origen documentado, consentimiento, preferencias, oposición, supresión = anonimizar + lista de no contactar.
- Preparado para fases 3-6: source/external_source_id (Meta, Google Places), score/ai_summary (IA), preferencias comm_* (Resend/WhatsApp con consentimiento).
- Pruebas: scripts/test-crm.mjs (37/37).

## Pendiente / siguientes pasos
- Producción: tras publicar, pulsar "Configurar Stripe ahora" (Super Admin → Planes) para añadir el evento invoice.paid al webhook live.
- Definir la fecha de lanzamiento en el panel de Super Admin.
- Textos de marketing que dicen "gratis durante el lanzamiento" no cambian solos tras la fecha.

## Fase 3 — Captación automática de leads (nov 2026) ✅
- Formulario público reutilizable (components/marketing/LeadCaptureForm.jsx) en home (#contacto), /contacto y /demo. Página /privacidad (datos legales editables en Super Admin → Captación → Canales).
- Consentimientos separados y no premarcados (gestión obligatoria; email y WhatsApp opcionales); versión de textos lib/crm/consent.js (CONSENT_VERSION) guardada con fecha y origen en crm_leads.metadata.last_capture.consents.
- Antispam: SOLO protección invisible (decisión del usuario): honeypot «website», tiempo mínimo 3 s, 5 envíos/10 min por IP (hash), 3/h por email, Origin propio. Turnstile implementado pero inactivo (se activa si existen NEXT_PUBLIC_TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY).
- Tabla nueva crm_capture_events (idempotencia por (channel, external_id) e idempotency_key; métricas; sin datos personales). Tipo de actividad 'capture' añadido a crm_activities. Ajustes en platform_settings: capture_channels, legal_info, meta_status, meta_verify_token, capture_salt.
- Duplicados: mismo email → actualiza solo campos vacíos + actividad; mismo email con otro nombre y negocio → revisión manual; solo mismo teléfono → lead nuevo + revisión. Nunca fusiona. Suprimidos que vuelven por iniciativa propia → se acepta (decisión del usuario).
- Meta Lead Ads (Graph v27.0): /api/meta/webhook (verificación hub.challenge + firma X-Hub-Signature-256), descarga del lead, fb/ig, campaña/conjunto/anuncio, reintentos (cron capture-retry */15). Estado REAL: PENDIENTE DE CONFIGURACIÓN (faltan META_APP_ID, META_APP_SECRET, META_PAGE_ID, META_PAGE_ACCESS_TOKEN).
- Super Admin → Growth Engine → Captación: Resumen (métricas con filtros), Canales (web/Facebook/Instagram, toggles, prueba, conexión Meta, datos legales), Eventos, Revisión.
- Pruebas: scripts/test-captacion.mjs 54/54; testing agent 15/15.
- Pendiente: credenciales de Meta + app en modo desarrollo; completar NIF/dirección en datos legales; si se aloja en Vercel, copiar allí las variables de entorno y crear el cron de reintentos.
