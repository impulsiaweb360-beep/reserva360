// Bot de reservas por WhatsApp con men\u00fas y botones.
// Flujo: Men\u00fa \u2192 Reservar (servicio \u2192 profesional \u2192 d\u00eda \u2192 hora \u2192 nombre \u2192 confirmar)
//        Mis citas \u2192 cita \u2192 Cambiar hora (d\u00eda \u2192 hora \u2192 confirmar) | Cancelar (confirmar)
//        Informaci\u00f3n (direcci\u00f3n, tel\u00e9fono, horario)
import { sendAndLog, notifyAppointment } from './notify';
import { normalizePhone, findClientsByPhone, samePhone } from '../phone';
import { getSlotsRange, createBooking, rescheduleAppointment, cancelAppointment, tenantTz, BookingError } from '../booking-server';
import { todayStr, formatWhen, formatTime, localParts } from '../tz';
import { DEFAULT_BUSINESS_HOURS } from '../booking';

const SESSION_TTL_MS = 30 * 60 * 1000;
const DAYS_AHEAD = 21;
const GREETING = /^(hola|buenas|buenos|hey|hi|hello|men[u\u00fa]|inicio|empezar|start|volver|ayuda|help|reservar|cita)\b/i;

const cut = (s, n) => {
  const v = String(s ?? '').trim();
  return v.length > n ? `${v.slice(0, n - 1)}\u2026` : v;
};

const DOW_NAMES = ['Domingo', 'Lunes', 'Martes', 'Mi\u00e9rcoles', 'Jueves', 'Viernes', 'S\u00e1bado'];

function dayTitle(ds) {
  const [y, m, d] = ds.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const s = dt.toLocaleDateString('es-ES', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
  return cut(s.charAt(0).toUpperCase() + s.slice(1), 24);
}

// ---------- Sesi\u00f3n de conversaci\u00f3n ----------
async function loadSession(supabase, tenantId, phone) {
  try {
    const { data } = await supabase
      .from('whatsapp_sessions').select('*')
      .eq('tenant_id', tenantId).eq('phone', phone).maybeSingle();
    return data || null;
  } catch {
    return null;
  }
}

async function saveSession(supabase, tenantId, phone, state) {
  try {
    await supabase.from('whatsapp_sessions').upsert(
      { tenant_id: tenantId, phone, state, updated_at: new Date().toISOString(), last_inbound_at: new Date().toISOString() },
      { onConflict: 'tenant_id,phone' }
    );
  } catch {}
}

// ---------- Env\u00edo ----------
function makeSender({ supabase, cfg, to }) {
  const send = (message, kind = 'bot') => sendAndLog({ supabase, cfg, to, message, kind, direct: true });
  return {
    text: (body) => send({ type: 'text', text: { body: cut(body, 4000), preview_url: true } }),
    buttons: (body, buttons) =>
      send({
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: cut(body, 1024) },
          action: {
            buttons: buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: cut(b.title, 20) } })),
          },
        },
      }),
    list: (body, button, rows, sectionTitle = 'Opciones') =>
      send({
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: cut(body, 1024) },
          action: {
            button: cut(button, 20),
            sections: [{
              title: cut(sectionTitle, 24),
              rows: rows.slice(0, 10).map((r) => ({
                id: r.id,
                title: cut(r.title, 24),
                ...(r.description ? { description: cut(r.description, 72) } : {}),
              })),
            }],
          },
        },
      }),
  };
}

// ---------- Datos ----------
async function activeServices(supabase, tenantId) {
  const { data } = await supabase
    .from('services').select('*').eq('tenant_id', tenantId).eq('active', true).order('name');
  return data || [];
}
async function activeEmployees(supabase, tenantId) {
  const { data } = await supabase
    .from('employees').select('*').eq('tenant_id', tenantId).eq('active', true).order('first_name');
  return data || [];
}

async function upcomingAppointmentsForPhone(supabase, tenantId, phone) {
  const clients = await findClientsByPhone(supabase, tenantId, phone);
  if (clients.length === 0) return { clients, appts: [] };
  const { data } = await supabase
    .from('appointments')
    .select('id, start_at, end_at, status, employee_id, service_id, client_id, service:services(name, duration_minutes, price), employee:employees(first_name, last_name)')
    .eq('tenant_id', tenantId)
    .in('client_id', clients.map((c) => c.id))
    .in('status', ['pending', 'confirmed'])
    .gte('start_at', new Date().toISOString())
    .order('start_at')
    .limit(10);
  return { clients, appts: data || [] };
}

async function loadOwnedAppointment(supabase, tenantId, apptId, phone) {
  const { data } = await supabase
    .from('appointments')
    .select('id, tenant_id, start_at, end_at, status, employee_id, service_id, client:clients(first_name, last_name, phone), service:services(name, duration_minutes, price), employee:employees(first_name, last_name)')
    .eq('id', apptId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!data || !samePhone(data.client?.phone, phone)) return null;
  return data;
}

function hoursSummary(tenant) {
  const bh = tenant?.business_hours && Object.keys(tenant.business_hours).length ? tenant.business_hours : DEFAULT_BUSINESS_HOURS;
  return [1, 2, 3, 4, 5, 6, 0]
    .map((d) => {
      const h = bh[d] || bh[String(d)];
      if (!h?.enabled) return `\u2022 ${DOW_NAMES[d]}: cerrado`;
      const brk = h.breakFrom && h.breakTo ? ` (descanso ${h.breakFrom}\u2013${h.breakTo})` : '';
      return `\u2022 ${DOW_NAMES[d]}: ${h.from}\u2013${h.to}${brk}`;
    })
    .join('\n');
}

// ---------- Pantallas ----------
async function showMenu(ctx, greet = true) {
  const { tenant, out, name } = ctx;
  const hello = greet ? `\u00a1Hola${name ? ` ${name.split(' ')[0]}` : ''}! \ud83d\udc4b Soy el asistente de reservas de *${tenant.name}*.\n\n` : '';
  await out.buttons(`${hello}\u00bfQu\u00e9 quieres hacer?`, [
    { id: 'm:book', title: '\ud83d\udcc5 Reservar cita' },
    { id: 'm:my', title: '\ud83d\uddc2\ufe0f Mis citas' },
    { id: 'm:info', title: '\u2139\ufe0f Informaci\u00f3n' },
  ]);
  return { step: 'menu' };
}

async function showServices(ctx) {
  const { supabase, tenant, out } = ctx;
  const services = await activeServices(supabase, tenant.id);
  if (services.length === 0) {
    await out.text('Ahora mismo no hay servicios disponibles para reservar. Contacta con el negocio, por favor.');
    return { step: 'menu' };
  }
  await out.list(
    '\ud83d\udcc5 *Nueva reserva*\n\nElige el servicio que quieres reservar:',
    'Ver servicios',
    services.map((s) => ({ id: `svc:${s.id}`, title: s.name, description: `${s.duration_minutes} min \u00b7 ${Number(s.price)}\u20ac` })),
    'Servicios'
  );
  return { step: 'service', mode: 'book' };
}

async function showEmployees(ctx, state) {
  const { supabase, tenant, out } = ctx;
  const employees = await activeEmployees(supabase, tenant.id);
  if (employees.length === 0) {
    await out.text('Ahora mismo no hay profesionales disponibles. Contacta con el negocio, por favor.');
    return { step: 'menu' };
  }
  if (employees.length === 1) return showDays(ctx, { ...state, employeeId: employees[0].id });
  await out.list(
    '\u00bfCon qui\u00e9n quieres la cita?',
    'Elegir profesional',
    [
      { id: 'emp:any', title: 'Cualquiera', description: 'El primer profesional disponible' },
      ...employees.slice(0, 9).map((e) => ({ id: `emp:${e.id}`, title: `${e.first_name} ${e.last_name || ''}`, description: e.specialty || '' })),
    ],
    'Profesionales'
  );
  return { ...state, step: 'employee' };
}

async function slotContext(ctx, state) {
  const { supabase, tenant } = ctx;
  const { data: service } = await supabase.from('services').select('*').eq('id', state.serviceId).eq('tenant_id', tenant.id).maybeSingle();
  let employees = [];
  if (!state.employeeId || state.employeeId === 'any') employees = await activeEmployees(supabase, tenant.id);
  else {
    const { data: e } = await supabase.from('employees').select('*').eq('id', state.employeeId).eq('tenant_id', tenant.id).maybeSingle();
    employees = e ? [e] : [];
  }
  return { service, employees };
}

async function showDays(ctx, state) {
  const { supabase, tenant, out } = ctx;
  const { service, employees } = await slotContext(ctx, state);
  if (!service || employees.length === 0) {
    await out.text('Ese servicio ya no est\u00e1 disponible.');
    return showMenu(ctx, false);
  }
  const range = await getSlotsRange({
    supabase, tenant, service, employees,
    fromDate: todayStr(tenantTz(tenant)), days: DAYS_AHEAD,
    excludeApptId: state.mode === 'reschedule' ? state.apptId : null,
  });
  const days = Object.entries(range).filter(([, s]) => s.length > 0).slice(0, 10);
  if (days.length === 0) {
    await out.buttons('\ud83d\ude14 No hay huecos libres en las pr\u00f3ximas 3 semanas. Prueba con otro servicio o profesional.', [
      { id: state.mode === 'reschedule' ? 'm:my' : 'm:book', title: '\u21a9\ufe0f Volver' },
      { id: 'menu', title: '\ud83c\udfe0 Men\u00fa' },
    ]);
    return { ...state, step: 'menu' };
  }
  await out.list(
    `*${service.name}* (${service.duration_minutes} min)\n\nElige el d\u00eda:`,
    'Ver d\u00edas',
    days.map(([ds, s]) => ({ id: `day:${ds}`, title: dayTitle(ds), description: `${s.length} ${s.length === 1 ? 'hora libre' : 'horas libres'}` })),
    'D\u00edas disponibles'
  );
  return { ...state, step: 'day' };
}

async function showSlots(ctx, state, page = 0) {
  const { supabase, tenant, out } = ctx;
  const { service, employees } = await slotContext(ctx, state);
  if (!service || employees.length === 0) return showMenu(ctx, false);
  const range = await getSlotsRange({
    supabase, tenant, service, employees, fromDate: state.date, days: 1,
    excludeApptId: state.mode === 'reschedule' ? state.apptId : null,
  });
  const slots = range[state.date] || [];
  if (slots.length === 0) {
    await out.text('Ese d\u00eda ya no tiene horas libres. Elige otro, por favor.');
    return showDays(ctx, state);
  }
  const PAGE = 9;
  const pageSlots = slots.slice(page * PAGE, page * PAGE + PAGE);
  const hasMore = slots.length > (page + 1) * PAGE;
  const rows = pageSlots.map((s) => ({ id: `slot:${s.start}|${s.employeeId}`, title: s.label }));
  if (hasMore) rows.push({ id: `more:${state.date}:${page + 1}`, title: 'Ver m\u00e1s horas \u27a1\ufe0f' });
  else if (page > 0) rows.push({ id: `more:${state.date}:0`, title: '\u2b05\ufe0f Primeras horas' });
  await out.list(`*${dayTitle(state.date)}*\n\nElige la hora:`, 'Ver horas', rows, 'Horas libres');
  return { ...state, step: 'slot' };
}

async function confirmBookingScreen(ctx, state) {
  const { supabase, tenant, out } = ctx;
  const { data: service } = await supabase.from('services').select('*').eq('id', state.serviceId).maybeSingle();
  const { data: emp } = await supabase.from('employees').select('first_name, last_name').eq('id', state.slotEmployeeId).maybeSingle();
  const tz = tenantTz(tenant);
  await out.buttons(
    `\ud83d\udcdd *Confirma tu reserva*\n\n\u2022 Servicio: *${service?.name}*\n\u2022 Con: ${emp?.first_name || ''} ${emp?.last_name || ''}\n\u2022 Cu\u00e1ndo: *${formatWhen(state.slotStart, tz)}*\n\u2022 Precio: ${Number(service?.price || 0)}\u20ac\n\u2022 A nombre de: ${state.name}`,
    [
      { id: 'ok:book', title: '\u2705 Confirmar' },
      { id: `day:${state.date}`, title: '\ud83d\udd04 Otra hora' },
      { id: 'menu', title: '\u274c Cancelar' },
    ]
  );
  return { ...state, step: 'confirm' };
}

async function askName(ctx, state) {
  const { out, profileName } = ctx;
  if (profileName) {
    await out.buttons('\u00bfA nombre de qui\u00e9n hacemos la reserva? Pulsa el bot\u00f3n o escribe tu nombre y apellido.', [
      { id: 'name:profile', title: cut(profileName, 20) },
    ]);
  } else {
    await out.text('\u00bfA nombre de qui\u00e9n hacemos la reserva? Escribe tu nombre y apellido.');
  }
  return { ...state, step: 'awaiting_name' };
}

async function doBook(ctx, state) {
  const { supabase, tenant, out, from, baseUrl } = ctx;
  const [firstName, ...rest] = String(state.name || '').trim().split(/\s+/);
  try {
    const res = await createBooking({
      supabase, tenantId: tenant.id, serviceId: state.serviceId, employeeId: state.slotEmployeeId,
      start: state.slotStart, client: { firstName, lastName: rest.join(' '), phone: from }, source: 'whatsapp',
    });
    const tz = tenantTz(tenant);
    await out.text(
      `\u2705 *\u00a1Reserva confirmada!*\n\n${res.service.name} con ${res.employee.first_name}\n\ud83d\udcc5 ${formatWhen(res.appointment.start_at, tz)}${tenant.address ? `\n\ud83d\udccd ${tenant.address}` : ''}\n\nPuedes cambiarla o cancelarla aqu\u00ed: ${baseUrl}/manage/${res.appointment.id}\nO escribe *men\u00fa* cuando quieras.`
    );
    // Aviso al negocio (el cliente ya tiene la confirmaci\u00f3n en el chat)
    await notifyAppointment(supabase, res.appointment.id, 'created', { baseUrl, notifyBusiness: true, skipCustomer: true });
    return { step: 'menu', name: state.name };
  } catch (e) {
    const msg = e instanceof BookingError ? e.message : 'No se pudo crear la reserva.';
    await out.text(`\u26a0\ufe0f ${msg} Elige otra hora, por favor.`);
    return showSlots(ctx, state, 0);
  }
}

async function showMyAppointments(ctx) {
  const { supabase, tenant, out, from } = ctx;
  const { appts } = await upcomingAppointmentsForPhone(supabase, tenant.id, from);
  if (appts.length === 0) {
    await out.buttons('No tienes citas pr\u00f3ximas con este n\u00famero.', [
      { id: 'm:book', title: '\ud83d\udcc5 Reservar cita' },
      { id: 'menu', title: '\ud83c\udfe0 Men\u00fa' },
    ]);
    return { step: 'menu' };
  }
  const tz = tenantTz(tenant);
  await out.list(
    `\ud83d\uddc2\ufe0f Tienes ${appts.length} ${appts.length === 1 ? 'cita pr\u00f3xima' : 'citas pr\u00f3ximas'}. Elige una para cambiarla o cancelarla:`,
    'Ver mis citas',
    appts.map((a) => {
      const lp = localParts(a.start_at, tz);
      return {
        id: `appt:${a.id}`,
        title: `${dayTitle(lp.dateStr)} ${formatTime(a.start_at, tz)}`,
        description: `${a.service?.name || ''} \u00b7 ${a.employee?.first_name || ''}`,
      };
    }),
    'Mis citas'
  );
  return { step: 'my' };
}

async function showAppointment(ctx, apptId) {
  const { supabase, tenant, out, from } = ctx;
  const a = await loadOwnedAppointment(supabase, tenant.id, apptId, from);
  if (!a || !['pending', 'confirmed'].includes(a.status)) {
    await out.text('No he encontrado esa cita.');
    return showMyAppointments(ctx);
  }
  await out.buttons(
    `\ud83d\udcc5 *${formatWhen(a.start_at, tenantTz(tenant))}*\n${a.service?.name} con ${a.employee?.first_name || ''} ${a.employee?.last_name || ''}\n\n\u00bfQu\u00e9 quieres hacer?`,
    [
      { id: `chg:${a.id}`, title: '\ud83d\udd04 Cambiar hora' },
      { id: `can:${a.id}`, title: '\u274c Cancelar cita' },
      { id: 'menu', title: '\ud83c\udfe0 Men\u00fa' },
    ]
  );
  return { step: 'appt', apptId: a.id };
}

// ---------- Entrada principal ----------
export async function handleInbound({ supabase, tenant, cfg, msg, baseUrl }) {
  const from = normalizePhone(msg?.from, cfg.country_code || '34');
  if (!from) return;

  let replyId = null;
  let text = '';
  if (msg.type === 'text') text = msg.text?.body || '';
  else if (msg.type === 'interactive') replyId = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || null;
  else if (msg.type === 'button') { replyId = null; text = msg.button?.text || msg.button?.payload || ''; }

  const session = await loadSession(supabase, tenant.id, from);
  const expired = !session || Date.now() - new Date(session.updated_at).getTime() > SESSION_TTL_MS;
  let state = expired ? {} : session.state || {};

  const existing = await findClientsByPhone(supabase, tenant.id, from);
  const knownName = existing[0] ? `${existing[0].first_name || ''} ${existing[0].last_name || ''}`.trim() : null;

  const ctx = {
    supabase, tenant, cfg, from, baseUrl,
    out: makeSender({ supabase, cfg, to: from }),
    profileName: msg.customerProfile?.name || null,
    name: state.name || knownName,
  };

  const t = text.trim();
  let next;

  try {
    if (!replyId) {
      if (state.step === 'awaiting_name' && t && !GREETING.test(t)) {
        next = await confirmBookingScreen(ctx, { ...state, name: cut(t, 60) });
      } else if (expired || GREETING.test(t) || !state.step) {
        next = await showMenu(ctx, true);
      } else {
        await ctx.out.text('No te he entendido \ud83e\udd14 Usa los botones o escribe *men\u00fa*.');
        next = await showMenu(ctx, false);
      }
    } else {
      const [kind, ...restParts] = replyId.split(':');
      const arg = restParts.join(':');
      switch (kind) {
        case 'menu': next = await showMenu(ctx, false); break;
        case 'm':
          if (arg === 'book') next = await showServices(ctx);
          else if (arg === 'my') next = await showMyAppointments(ctx);
          else {
            await ctx.out.text(
              `\u2139\ufe0f *${tenant.name}*${tenant.address ? `\n\ud83d\udccd ${tenant.address}` : ''}${tenant.phone ? `\n\ud83d\udcde ${tenant.phone}` : ''}${tenant.email ? `\n\u2709\ufe0f ${tenant.email}` : ''}\n\n*Horario*\n${hoursSummary(tenant)}${tenant.slug ? `\n\nTambi\u00e9n puedes reservar en la web: ${baseUrl}/book/${tenant.slug}` : ''}`
            );
            next = await showMenu(ctx, false);
          }
          break;
        case 'svc': next = await showEmployees(ctx, { mode: 'book', serviceId: arg, name: state.name }); break;
        case 'emp': next = await showDays(ctx, { ...state, mode: 'book', employeeId: arg }); break;
        case 'day': next = await showSlots(ctx, { ...state, date: arg }, 0); break;
        case 'more': {
          const [date, page] = [arg.slice(0, 10), Number(arg.slice(11)) || 0];
          next = await showSlots(ctx, { ...state, date }, page);
          break;
        }
        case 'slot': {
          const [slotStart, slotEmployeeId] = arg.split('|');
          const s = { ...state, slotStart, slotEmployeeId };
          if (state.mode === 'reschedule') {
            await ctx.out.buttons(`\u00bfCambiamos tu cita al *${formatWhen(slotStart, tenantTz(tenant))}*?`, [
              { id: 'ok:chg', title: '\u2705 Confirmar' },
              { id: `day:${state.date}`, title: '\ud83d\udd04 Otra hora' },
              { id: 'menu', title: '\u274c No cambiar' },
            ]);
            next = { ...s, step: 'confirm_chg' };
          } else {
            const name = state.name || knownName;
            next = name ? await confirmBookingScreen(ctx, { ...s, name }) : await askName(ctx, s);
          }
          break;
        }
        case 'name':
          next = await confirmBookingScreen(ctx, { ...state, name: cut(ctx.profileName || 'Cliente', 60) });
          break;
        case 'ok':
          if (arg === 'book' && state.slotStart && state.serviceId) next = await doBook(ctx, state);
          else if (arg === 'chg' && state.apptId && state.slotStart) {
            const owned = await loadOwnedAppointment(supabase, tenant.id, state.apptId, from);
            if (!owned) { await ctx.out.text('No he encontrado esa cita.'); next = await showMenu(ctx, false); break; }
            try {
              const upd = await rescheduleAppointment({ supabase, apptId: state.apptId, start: state.slotStart });
              await ctx.out.text(`\u2705 *Cita cambiada*\n\nNueva fecha: *${formatWhen(upd.start_at, tenantTz(tenant))}*\n\nGestiona tu cita: ${baseUrl}/manage/${upd.id}`);
              next = { step: 'menu', name: state.name };
            } catch (e) {
              await ctx.out.text(`\u26a0\ufe0f ${e instanceof BookingError ? e.message : 'No se pudo cambiar la cita.'} Elige otra hora.`);
              next = await showSlots(ctx, state, 0);
            }
          } else next = await showMenu(ctx, false);
          break;
        case 'appt': next = await showAppointment(ctx, arg); break;
        case 'chg': {
          const a = await loadOwnedAppointment(supabase, tenant.id, arg, from);
          if (!a) { await ctx.out.text('No he encontrado esa cita.'); next = await showMenu(ctx, false); break; }
          next = await showDays(ctx, { mode: 'reschedule', apptId: a.id, serviceId: a.service_id, employeeId: a.employee_id, name: state.name });
          break;
        }
        case 'can':
          await ctx.out.buttons('\u00bfSeguro que quieres *cancelar* esta cita?', [
            { id: `cany:${arg}`, title: 'S\u00ed, cancelar' },
            { id: `appt:${arg}`, title: 'No, mantener' },
          ]);
          next = { ...state, step: 'confirm_cancel', apptId: arg };
          break;
        case 'cany': {
          const a = await loadOwnedAppointment(supabase, tenant.id, arg, from);
          if (!a) { await ctx.out.text('No he encontrado esa cita.'); next = await showMenu(ctx, false); break; }
          try {
            await cancelAppointment({ supabase, apptId: a.id });
            await ctx.out.buttons(`Tu cita del ${formatWhen(a.start_at, tenantTz(tenant))} ha sido *cancelada*.`, [
              { id: 'm:book', title: '\ud83d\udcc5 Reservar otra' },
              { id: 'menu', title: '\ud83c\udfe0 Men\u00fa' },
            ]);
          } catch (e) {
            await ctx.out.text(`\u26a0\ufe0f ${e?.message || 'No se pudo cancelar.'}`);
          }
          next = { step: 'menu', name: state.name };
          break;
        }
        default:
          next = await showMenu(ctx, false);
      }
    }
  } catch (e) {
    console.error('[whatsapp bot] error', e);
    try { await ctx.out.text('\u26a0\ufe0f Ha habido un problema. Escribe *men\u00fa* para empezar de nuevo.'); } catch {}
    next = {};
  }

  await saveSession(supabase, tenant.id, from, next || {});
}
