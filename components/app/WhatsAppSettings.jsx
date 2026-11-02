'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  MessageCircle, CheckCircle2, AlertTriangle, Copy, RefreshCw, Send, Unplug, Loader2, ExternalLink, Bot,
} from 'lucide-react';

const TPL_STATUS = {
  APPROVED: { label: 'Aprobada', cls: 'bg-emerald-100 text-emerald-700' },
  PENDING: { label: 'En revisión', cls: 'bg-amber-100 text-amber-700' },
  IN_APPEAL: { label: 'En revisión', cls: 'bg-amber-100 text-amber-700' },
  REJECTED: { label: 'Rechazada', cls: 'bg-rose-100 text-rose-700' },
  PAUSED: { label: 'Pausada', cls: 'bg-zinc-200 text-zinc-700' },
  DISABLED: { label: 'Desactivada', cls: 'bg-zinc-200 text-zinc-700' },
  NO_CREADA: { label: 'No creada', cls: 'bg-zinc-100 text-zinc-600' },
  ERROR: { label: 'Error', cls: 'bg-rose-100 text-rose-700' },
  DESCONOCIDO: { label: '—', cls: 'bg-zinc-100 text-zinc-600' },
};

const MSG_KIND = {
  created: 'Confirmación', reminder: 'Recordatorio', rescheduled: 'Cita cambiada',
  cancelled: 'Cita cancelada', business_new: 'Aviso al negocio', test: 'Prueba',
};

const NOTIFS = [
  { key: 'notify_confirmation', label: 'Confirmación al cliente al reservar' },
  { key: 'notify_reminder', label: 'Recordatorio al cliente 24h antes' },
  { key: 'notify_changes', label: 'Aviso al cliente si se cambia o cancela' },
  { key: 'notify_business', label: 'Aviso al negocio de cada reserva nueva' },
];

const DEFAULT_FORM = {
  api_key: '', phone: '', business_phone: '', country_code: '34', webhook_secret: '',
  notify_confirmation: true, notify_reminder: true, notify_changes: true, notify_business: true,
};

export default function WhatsAppSettings({ tenantId }) {
  const endpoint = `/api/whatsapp/config${tenantId ? `?tenant_id=${tenantId}` : ''}`;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [busy, setBusy] = useState(null);
  const [reconnect, setReconnect] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [warning, setWarning] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(endpoint);
      const j = await r.json();
      setData(r.ok ? j : { error: j.error });
      if (j?.config) {
        setForm((f) => ({
          ...f,
          phone: j.config.phone || '',
          business_phone: j.config.business_phone || '',
          country_code: j.config.country_code || '34',
          notify_confirmation: j.config.notify_confirmation,
          notify_reminder: j.config.notify_reminder,
          notify_changes: j.config.notify_changes,
          notify_business: j.config.notify_business,
        }));
      }
    } catch (e) {
      setData({ error: String(e?.message || e) });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const post = async (action, extra = {}) => {
    setBusy(action);
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Error');
      return j;
    } finally {
      setBusy(null);
    }
  };

  const connect = async () => {
    try {
      const j = await post('connect', form);
      setWarning(j.webhookWarning || null);
      toast.success('WhatsApp conectado. Las plantillas de avisos se han enviado a revisión de Meta.');
      setReconnect(false);
      setForm((f) => ({ ...f, api_key: '' }));
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const save = async () => {
    try {
      await post('save', form);
      toast.success('Ajustes de WhatsApp guardados');
      setForm((f) => ({ ...f, webhook_secret: '' }));
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const recreateTemplates = async () => {
    try {
      await post('templates');
      toast.success('Plantillas enviadas a revisión');
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const sendTest = async () => {
    try {
      await post('test', { to: testTo });
      toast.success('Mensaje de prueba enviado');
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('¿Desconectar WhatsApp? El bot dejará de responder y no se enviarán más avisos.')) return;
    try {
      await post('disconnect');
      toast.success('WhatsApp desconectado');
      setForm(DEFAULT_FORM);
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const copy = (t) => { navigator.clipboard?.writeText(t); toast.success('Copiado'); };

  const cfg = data?.config;
  const connected = Boolean(cfg?.enabled);

  const notifToggles = (
    <div className="grid gap-2 sm:grid-cols-2">
      {NOTIFS.map((n) => (
        <label key={n.key} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
          <span>{n.label}</span>
          <Switch
            data-testid={`wa-${n.key}`}
            checked={Boolean(form[n.key])}
            onCheckedChange={(v) => setForm({ ...form, [n.key]: v })}
          />
        </label>
      ))}
    </div>
  );

  return (
    <Card data-testid="whatsapp-settings">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-5 w-5 text-emerald-600" /> WhatsApp (YCloud)
        </CardTitle>
        {connected ? (
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100" data-testid="wa-status">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Conectado
          </Badge>
        ) : (
          <Badge variant="outline" data-testid="wa-status">Sin conectar</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : data?.migrationNeeded ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800" data-testid="wa-migration-needed">
            <div className="mb-1 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Falta un paso en la base de datos</div>
            Ejecuta el SQL <b>migration-whatsapp-horarios.sql</b> en Supabase → SQL Editor y recarga esta página.{' '}
            <a href="/migration-whatsapp-horarios.sql" target="_blank" rel="noreferrer" className="font-semibold underline">Descargar SQL</a>
          </div>
        ) : data?.error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{data.error}</div>
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
              <Bot className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                Tus clientes escriben <b>«hola»</b> a tu WhatsApp y un bot con menús les deja <b>reservar, ver, cambiar o cancelar</b> sus citas,
                respetando tu horario. Además se envían los avisos que actives abajo.
              </div>
            </div>

            {(!connected || reconnect) && (
              <div className="space-y-4">
                <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
                  <li>Crea tu cuenta en <a href="https://www.ycloud.com" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">YCloud <ExternalLink className="inline h-3 w-3" /></a> y conecta el número de WhatsApp de tu negocio.</li>
                  <li>En YCloud ve a <b>Developers → API Keys</b> y copia tu clave.</li>
                  <li>Pégala aquí con tu número y pulsa <b>Conectar</b>. Configuramos el bot y las plantillas de avisos automáticamente.</li>
                </ol>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">Clave API de YCloud</Label>
                    <Input
                      data-testid="wa-api-key"
                      type="password"
                      autoComplete="off"
                      placeholder={cfg?.api_key_masked || 'Pega tu clave'}
                      value={form.api_key}
                      onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Número de WhatsApp del negocio</Label>
                    <Input
                      data-testid="wa-phone"
                      placeholder="+34 600 111 222"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Móvil para recibir avisos de reservas nuevas</Label>
                    <Input
                      data-testid="wa-business-phone"
                      placeholder="+34 611 222 333"
                      value={form.business_phone}
                      onChange={(e) => setForm({ ...form, business_phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Prefijo del país de tus clientes</Label>
                    <Input
                      data-testid="wa-country-code"
                      placeholder="34"
                      value={form.country_code}
                      onChange={(e) => setForm({ ...form, country_code: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    />
                  </div>
                </div>
                {notifToggles}
                <div className="flex flex-wrap gap-2">
                  <Button data-testid="wa-connect" onClick={connect} disabled={busy === 'connect' || (!form.api_key && !cfg) || !form.phone}>
                    {busy === 'connect' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-1 h-4 w-4" />}
                    Conectar WhatsApp
                  </Button>
                  {reconnect && <Button variant="outline" onClick={() => setReconnect(false)}>Volver</Button>}
                </div>
              </div>
            )}

            {connected && !reconnect && (
              <div className="space-y-5">
                <div className="grid gap-3 text-sm sm:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-slate-500">Número conectado</div>
                    <div className="font-semibold" data-testid="wa-connected-phone">{cfg.phone}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-slate-500">Clave YCloud</div>
                    <div className="font-mono">{cfg.api_key_masked}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-slate-500">Bot de reservas</div>
                    {cfg.has_webhook ? (
                      <div className="font-semibold text-emerald-700">Activo</div>
                    ) : (
                      <div className="font-semibold text-amber-700">Falta el webhook</div>
                    )}
                  </div>
                </div>

                {(warning || !cfg.has_webhook) && (
                  <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <div className="font-semibold">Configura el webhook a mano en YCloud</div>
                    {warning && <div className="text-xs">{warning}</div>}
                    <div className="text-xs">En YCloud → Developers → Webhooks crea uno con esta URL y los eventos <i>whatsapp.inbound_message.received</i> y <i>whatsapp.message.updated</i>. Luego pega aquí el secreto.</div>
                    <div className="flex gap-2">
                      <Input readOnly value={data.webhookUrl} className="bg-white font-mono text-xs" />
                      <Button variant="outline" size="icon" onClick={() => copy(data.webhookUrl)}><Copy className="h-4 w-4" /></Button>
                    </div>
                    <Input
                      placeholder="Secreto del webhook (whsec_...)"
                      value={form.webhook_secret}
                      onChange={(e) => setForm({ ...form, webhook_secret: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                )}

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold">Plantillas de avisos</div>
                    <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="mr-1 h-3 w-3" /> Actualizar</Button>
                  </div>
                  <p className="mb-2 text-xs text-slate-500">Meta revisa cada plantilla antes de poder usarla, normalmente en minutos u horas. Los avisos empiezan a enviarse cuando están <b>Aprobadas</b>.</p>
                  <div className="divide-y rounded-lg border" data-testid="wa-templates">
                    {(data.templates || []).map((t) => {
                      const st = TPL_STATUS[t.status] || { label: t.status, cls: 'bg-zinc-100 text-zinc-600' };
                      return (
                        <div key={t.name} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                          <div>
                            <div className="font-medium">{t.label}</div>
                            <div className="font-mono text-[11px] text-slate-400">{t.name}</div>
                            {t.reason && <div className="text-[11px] text-rose-600">{t.reason}</div>}
                          </div>
                          <Badge className={st.cls}>{st.label}</Badge>
                        </div>
                      );
                    })}
                  </div>
                  {(data.templates || []).some((t) => ['NO_CREADA', 'REJECTED', 'ERROR'].includes(t.status)) && (
                    <Button variant="outline" size="sm" className="mt-2" onClick={recreateTemplates} disabled={busy === 'templates'}>
                      {busy === 'templates' ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                      Crear plantillas que faltan
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-semibold">Avisos automáticos</div>
                  {notifToggles}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Móvil para recibir avisos de reservas nuevas</Label>
                      <Input value={form.business_phone} placeholder="+34 611 222 333" onChange={(e) => setForm({ ...form, business_phone: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Prefijo del país de tus clientes</Label>
                      <Input value={form.country_code} onChange={(e) => setForm({ ...form, country_code: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
                    </div>
                  </div>
                  <Button data-testid="wa-save" onClick={save} disabled={busy === 'save'}>
                    {busy === 'save' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Guardar ajustes
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-semibold">Enviar mensaje de prueba</div>
                  <div className="flex gap-2">
                    <Input placeholder="+34 600 000 000" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
                    <Button variant="outline" onClick={sendTest} disabled={!testTo || busy === 'test'}>
                      {busy === 'test' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />} Enviar
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">Usa la plantilla de confirmación: solo funciona cuando está aprobada.</p>
                </div>

                {(data.messages || []).length > 0 && (
                  <div>
                    <div className="mb-2 text-sm font-semibold">Últimos avisos enviados</div>
                    <div className="max-h-64 divide-y overflow-y-auto rounded-lg border text-xs">
                      {data.messages.map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2">
                          <div className="min-w-0">
                            <div className="font-medium">{MSG_KIND[m.kind] || m.kind} · {m.to_phone}</div>
                            <div className="text-slate-400">{new Date(m.created_at).toLocaleString('es-ES')}</div>
                            {m.error && <div className="truncate text-rose-600" title={m.error}>{m.error}</div>}
                          </div>
                          <Badge variant="outline" className={m.status === 'failed' ? 'border-rose-300 text-rose-600' : ''}>{m.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 border-t pt-4">
                  <Button variant="outline" onClick={() => setReconnect(true)}>Cambiar clave o número</Button>
                  <Button variant="ghost" className="text-rose-600 hover:text-rose-700" onClick={disconnect} disabled={busy === 'disconnect'}>
                    <Unplug className="mr-1 h-4 w-4" /> Desconectar
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
