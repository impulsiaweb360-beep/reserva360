// Utilidades de zona horaria (sin dependencias). Funcionan igual en servidor (UTC) y navegador.
// El horario de los negocios se guarda en hora LOCAL del negocio; por defecto Europe/Madrid.

export const DEFAULT_TZ = 'Europe/Madrid';

const fmtCache = new Map();
function getFmt(timeZone) {
  if (!fmtCache.has(timeZone)) {
    fmtCache.set(
      timeZone,
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', weekday: 'short',
      })
    );
  }
  return fmtCache.get(timeZone);
}

function parts(date, timeZone) {
  const out = {};
  for (const p of getFmt(timeZone).formatToParts(date)) out[p.type] = p.value;
  return out;
}

// Offset con la misma convención que Date#getTimezoneOffset (UTC - local, en minutos). Madrid invierno = -60.
export function tzOffsetMinutes(date, timeZone = DEFAULT_TZ) {
  try {
    const p = parts(date, timeZone);
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
    const d = new Date(date);
    d.setUTCSeconds(0, 0);
    return Math.round((d.getTime() - asUtc) / 60000);
  } catch {
    return -60;
  }
}

// Fecha/hora local del negocio para un instante: { dateStr: 'YYYY-MM-DD', minutes, dow }
export function localParts(date, timeZone = DEFAULT_TZ) {
  const p = parts(new Date(date), timeZone);
  const dateStr = `${p.year}-${p.month}-${p.day}`;
  const minutes = (+p.hour % 24) * 60 + +p.minute;
  const dow = new Date(Date.UTC(+p.year, +p.month - 1, +p.day)).getUTCDay();
  return { dateStr, minutes, dow };
}

// Convierte 'YYYY-MM-DD' + minutos desde medianoche (hora local del negocio) a Date UTC real
export function localToUtc(dateStr, minutes, timeZone = DEFAULT_TZ) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const naive = Date.UTC(y, m - 1, d) + minutes * 60000;
  const off1 = tzOffsetMinutes(new Date(naive), timeZone);
  let utc = naive + off1 * 60000;
  const off2 = tzOffsetMinutes(new Date(utc), timeZone);
  if (off2 !== off1) utc = naive + off2 * 60000;
  return new Date(utc);
}

export function addDaysStr(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function todayStr(timeZone = DEFAULT_TZ) {
  return localParts(new Date(), timeZone).dateStr;
}

export const hhmm = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// "lunes, 3 de noviembre, 10:00"
export function formatWhen(date, timeZone = DEFAULT_TZ) {
  return new Date(date).toLocaleString('es-ES', {
    timeZone,
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatWhenLong(date, timeZone = DEFAULT_TZ) {
  return new Date(date).toLocaleString('es-ES', {
    timeZone,
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatTime(date, timeZone = DEFAULT_TZ) {
  return new Date(date).toLocaleTimeString('es-ES', { timeZone, hour: '2-digit', minute: '2-digit' });
}
