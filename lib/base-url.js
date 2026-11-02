// URL pública de la app: prioridad a la cabecera de la petición (dominio real que usa el visitante)
export function getBaseUrl(request) {
  try {
    const host = request?.headers?.get('x-forwarded-host') || request?.headers?.get('host');
    if (host && !/^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/.test(host)) {
      const proto = request.headers.get('x-forwarded-proto') || 'https';
      return `${proto.split(',')[0]}://${host.split(',')[0]}`;
    }
  } catch {}
  return (process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/, '');
}
