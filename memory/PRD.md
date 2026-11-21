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

## Pendiente / siguientes pasos
- Producción: tras publicar, pulsar "Configurar Stripe ahora" (Super Admin → Planes) para añadir el evento invoice.paid al webhook live.
- Definir la fecha de lanzamiento en el panel de Super Admin.
- Textos de marketing que dicen "gratis durante el lanzamiento" no cambian solos tras la fecha.
