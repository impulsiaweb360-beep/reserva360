'use client';

// Growth Engine → Captación (Super Admin): canales, métricas reales, eventos y revisión manual
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Inbox, Globe, Facebook, Instagram, Loader2, RefreshCw, ShieldCheck, ShieldAlert, Copy, Eye, EyeOff, PlugZap, AlertTriangle,
  CalendarDays, CalendarRange, CalendarClock, Presentation, Info, UserPlus, Building2, Ban, Megaphone, FileText, CheckCircle2,
} from 'lucide-react';
import { Stat, fmtDateTime, leadName } from '@/components/app/crm/shared';

async function cap(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api/admin/capture/${path}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || `Error ${res.status}`); e.status = res.status; e.data = data; throw e; }
  return data;
}
const SELECT = 'h-9 rounded-md border border-input bg-background px-2 text-sm';
const STATE = {
  connected: { label: 'Conectado', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  pending_config: { label: 'Pendiente de configuración', cls: 'bg-amber-100 text-amber-900 border-amber-200' },
  unverified: { label: 'Credenciales sin verificar', cls: 'bg-slate-100 text-slate-800 border-slate-200' },
  error: { label: 'Error de conexión', cls: 'bg-rose-100 text-rose-800 border-rose-200' },
  no_account: { label: 'Sin cuenta de Instagram vinculada', cls: 'bg-amber-100 text-amber-900 border-amber-200' },
};
const EV_STATUS = {
  processed: ['Procesado', 'bg-emerald-100 text-emerald-800 border-emerald-200'], review: ['Revisión', 'bg-amber-100 text-amber-900 border-amber-200'],
  duplicate: ['Duplicado', 'bg-slate-100 text-slate-700 border-slate-200'], failed: ['Error', 'bg-rose-100 text-rose-800 border-rose-200'],
  ignored: ['Ignorado', 'bg-zinc-100 text-zinc-700 border-zinc-200'], spam: ['Spam bloqueado', 'bg-zinc-200 text-zinc-800 border-zinc-300'],
  rate_limited: ['Límite superado', 'bg-zinc-200 text-zinc-800 border-zinc-300'], test: ['Prueba', 'bg-sky-100 text-sky-800 border-sky-200'],
  received: ['Recibido', 'bg-indigo-100 text-indigo-800 border-indigo-200'],
};
const StateBadge = ({ state, testid }) => { const s = STATE[state] || STATE.unverified; return <Badge variant="outline" className={s.cls} data-testid={testid}>{s.label}</Badge>; };
const copy = async (t) => { try { await navigator.clipboard.writeText(t); toast.success('Copiado'); } catch { toast.error('No se pudo copiar'); } };
const onError = (e) => toast.error(e.message || 'Error');

// ------------------------------------------------------------------ Resumen
function Summary() {
  const [f, setF] = useState({ from: '', to: '', channel: 'all' });
  const [m, setM] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v && v !== 'all'));
    try { setM(await cap(`metrics?${qs}`)); } catch (e) { onError(e); } finally { setLoading(false); }
  }, [f]);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-4" data-testid="capture-summary">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3">
        <div><Label className="text-xs">Desde</Label><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className="h-9 w-40" data-testid="capture-from" /></div>
        <div><Label className="text-xs">Hasta</Label><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className="h-9 w-40" data-testid="capture-to" /></div>
        <div><Label className="text-xs">Canal</Label>
          <select className={`${SELECT} w-44`} value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })} data-testid="capture-channel-filter">
            <option value="all">Todos los canales</option><option value="web">Formulario web</option><option value="facebook">Facebook</option><option value="instagram">Instagram</option>
          </select>
        </div>
        {(f.from || f.to || f.channel !== 'all') && <Button variant="ghost" size="sm" onClick={() => setF({ from: '', to: '', channel: 'all' })}>Quitar filtros</Button>}
        {loading && <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      {m && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Recibidos hoy" value={m.today} icon={CalendarClock} testid="cap-today" />
            <Stat label="Esta semana" value={m.week} icon={CalendarRange} testid="cap-week" />
            <Stat label="Este mes" value={m.month} icon={CalendarDays} testid="cap-month" />
            <Stat label="Formularios recibidos" value={m.received} hint={`${m.uniqueLeads} leads distintos`} icon={Inbox} testid="cap-received" />
            <Stat label="Solicitudes de demo" value={m.demoRequests} icon={Presentation} testid="cap-demo" />
            <Stat label="Solicitudes de información" value={m.infoRequests} icon={Info} testid="cap-info" />
            <Stat label="Desde la web" value={m.bySource.web_form} icon={Globe} testid="cap-web" />
            <Stat label="Desde Facebook" value={m.bySource.facebook_lead_ads} icon={Facebook} testid="cap-fb" />
            <Stat label="Desde Instagram" value={m.bySource.instagram_lead_ads} icon={Instagram} testid="cap-ig" />
            <Stat label="Han iniciado el registro" value={m.signupStarted} hint={`de ${m.capturedLeads} leads captados`} icon={UserPlus} testid="cap-signup" />
            <Stat label="Negocios registrados" value={m.converted} hint={m.capturedLeads ? `${Math.round((m.converted / m.capturedLeads) * 100)}% de conversión` : 'sin leads aún'} icon={Building2} tone="text-emerald-700" testid="cap-converted" />
            <Stat label="Bloqueados (spam/límite)" value={m.blocked} hint={`${m.review} en revisión · ${m.failed} con error`} icon={Ban} testid="cap-blocked" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Megaphone className="h-4 w-4" />Leads por campaña</CardTitle></CardHeader>
              <CardContent>{m.campaigns.length ? (
                <ul className="divide-y text-sm" data-testid="cap-campaigns">{m.campaigns.map((c) => <li key={c.campaign_id || c.campaign_name} className="flex justify-between gap-2 py-2"><span className="truncate">{c.campaign_name}</span><b>{c.count}</b></li>)}</ul>
              ) : <p className="text-sm text-muted-foreground">Aún no hay leads de campañas de Meta.</p>}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" />Leads por formulario</CardTitle></CardHeader>
              <CardContent>{m.forms.length ? (
                <ul className="divide-y text-sm" data-testid="cap-forms">{m.forms.map((x) => <li key={`${x.source}${x.form}`} className="flex justify-between gap-2 py-2"><span className="truncate">{x.form}</span><b>{x.count}</b></li>)}</ul>
              ) : <p className="text-sm text-muted-foreground">Todavía no se ha recibido ningún formulario.</p>}</CardContent></Card>
          </div>
          <p className="text-xs text-muted-foreground">Datos reales de Supabase. No incluyen pruebas de funcionamiento, envíos bloqueados ni notificaciones repetidas.</p>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Canales
function ChannelToggle({ channel, enabled, onChange }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className="flex items-center gap-2 text-sm">
      <Switch checked={enabled} disabled={busy} data-testid={`cap-toggle-${channel}`} onCheckedChange={async (v) => {
        setBusy(true);
        try { await cap('channels', { method: 'POST', body: { channel, enabled: v } }); toast.success(v ? 'Fuente activada' : 'Fuente desactivada'); onChange(); } catch (e) { onError(e); } finally { setBusy(false); }
      }} />
      {enabled ? 'Activa' : 'Desactivada'}
    </label>
  );
}

function LegalCard() {
  const [v, setV] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { cap('legal').then(setV).catch(onError); }, []);
  if (!v) return null;
  return (
    <Card data-testid="cap-legal">
      <CardHeader className="pb-3"><CardTitle className="text-base">Datos legales (política de privacidad)</CardTitle>
        <CardDescription>Aparecen como responsable del tratamiento en <a className="underline" href="/privacidad" target="_blank" rel="noreferrer">/privacidad</a>.</CardDescription></CardHeader>
      <CardContent>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
          e.preventDefault(); setSaving(true);
          try { setV(await cap('legal', { method: 'POST', body: { owner: v.owner, nif: v.nif || null, address: v.address || null, email: v.email } })); toast.success('Datos legales guardados'); } catch (er) { onError(er); } finally { setSaving(false); }
        }}>
          <div><Label className="text-xs">Titular / razón social</Label><Input value={v.owner || ''} onChange={(e) => setV({ ...v, owner: e.target.value })} data-testid="cap-legal-owner" /></div>
          <div><Label className="text-xs">NIF / CIF</Label><Input value={v.nif || ''} onChange={(e) => setV({ ...v, nif: e.target.value })} placeholder="Pendiente" data-testid="cap-legal-nif" /></div>
          <div className="sm:col-span-2"><Label className="text-xs">Dirección</Label><Input value={v.address || ''} onChange={(e) => setV({ ...v, address: e.target.value })} placeholder="Pendiente" data-testid="cap-legal-address" /></div>
          <div><Label className="text-xs">Email de privacidad</Label><Input type="email" value={v.email || ''} onChange={(e) => setV({ ...v, email: e.target.value })} data-testid="cap-legal-email" /></div>
          <div className="flex items-end"><Button type="submit" disabled={saving} data-testid="cap-legal-save">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button></div>
        </form>
        {(!v.nif || !v.address) && <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-700"><AlertTriangle className="h-3.5 w-3.5" />Completa NIF/CIF y dirección para que la política de privacidad esté completa.</p>}
      </CardContent>
    </Card>
  );
}

function MetaSetup({ meta, reload }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(null);
  const run = async (what) => {
    setBusy(what);
    try {
      const r = await cap(`meta/${what}`, { method: 'POST' });
      if (r.connected) toast.success('Conexión con Meta verificada'); else toast.error(r.error || 'La conexión no está completa');
      reload();
    } catch (e) { onError(e); } finally { setBusy(null); }
  };
  return (
    <Card data-testid="cap-meta-setup">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base"><PlugZap className="h-4 w-4" />Conexión con Meta (Graph API {meta.graphVersion})</CardTitle>
          <StateBadge state={meta.state} testid="cap-meta-state" />
        </div>
        <CardDescription>Una sola app de Meta y tu Página de Facebook. Los leads de Instagram llegan a través de la misma Página.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {meta.missing.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900" data-testid="cap-meta-missing">
            <b>Faltan credenciales en el servidor:</b> {meta.missing.join(', ')}. Hasta que se añadan y se verifiquen, la integración no se muestra como conectada.
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <div><Label className="text-xs">URL de devolución de llamada (Webhooks → Page)</Label>
            <div className="mt-1 flex gap-1"><Input readOnly value={meta.webhookUrl} className="font-mono text-xs" data-testid="cap-meta-webhook-url" /><Button type="button" variant="outline" size="icon" onClick={() => copy(meta.webhookUrl)}><Copy className="h-4 w-4" /></Button></div></div>
          <div><Label className="text-xs">Token de verificación</Label>
            <div className="mt-1 flex gap-1"><Input readOnly type={show ? 'text' : 'password'} value={meta.verifyToken} className="font-mono text-xs" data-testid="cap-meta-verify-token" />
              <Button type="button" variant="outline" size="icon" onClick={() => setShow((s) => !s)}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
              <Button type="button" variant="outline" size="icon" onClick={() => copy(meta.verifyToken)}><Copy className="h-4 w-4" /></Button></div></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => run('test')} disabled={!!busy || meta.missing.length > 0} data-testid="cap-meta-test">{busy === 'test' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Probar conexión</Button>
          <Button variant="outline" onClick={() => run('subscribe')} disabled={!!busy || meta.missing.length > 0} data-testid="cap-meta-subscribe">{busy === 'subscribe' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Suscribir Página a «leadgen»</Button>
        </div>
        {meta.checkedAt && (
          <dl className="grid gap-x-6 gap-y-1 rounded-lg border p-3 md:grid-cols-2" data-testid="cap-meta-details">
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Última comprobación</dt><dd>{fmtDateTime(meta.checkedAt)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Página</dt><dd>{meta.page?.name || '—'}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Suscripción leadgen</dt><dd>{meta.subscribed ? 'Sí' : 'No'}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Token caduca</dt><dd>{meta.tokenExpiresAt ? fmtDateTime(meta.tokenExpiresAt) : meta.page ? 'No caduca' : '—'}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Último webhook</dt><dd>{fmtDateTime(meta.lastWebhookAt)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Permisos que faltan</dt><dd>{meta.missingScopes.length ? meta.missingScopes.join(', ') : meta.page ? 'Ninguno' : '—'}</dd></div>
          </dl>
        )}
        {(meta.error || meta.lastError) && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-800" data-testid="cap-meta-error">
            <AlertTriangle className="mr-1 inline h-4 w-4" />{meta.error || meta.lastError}{meta.lastErrorAt && !meta.error ? ` (${fmtDateTime(meta.lastErrorAt)})` : ''}
          </div>
        )}
        <details className="rounded-lg border p-3">
          <summary className="cursor-pointer font-medium">Cómo conectar Facebook e Instagram (paso a paso)</summary>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted-foreground">
            <li>En <b>developers.facebook.com</b> crea una app de tipo <b>Business</b> asociada a tu portfolio empresarial y a tu Página.</li>
            <li>Añade el producto <b>Webhooks</b> → objeto <b>Page</b>: pega la URL y el token de verificación de arriba y suscribe el campo <b>leadgen</b>.</li>
            <li>Genera un token de usuario con los permisos <b>{meta.requiredScopes.join(', ')}</b> (opcional: ads_management para nombres de campaña), cámbialo por uno de larga duración y obtén el <b>token de la Página</b> con <code>/me/accounts</code>.</li>
            <li>Introduce en el servidor (de forma segura) META_APP_ID, META_APP_SECRET, META_PAGE_ID y META_PAGE_ACCESS_TOKEN.</li>
            <li>Pulsa <b>Suscribir Página a «leadgen»</b> y después <b>Probar conexión</b>.</li>
            <li>Para Instagram, vincula tu cuenta profesional de Instagram a la Página en Meta Business Suite.</li>
            <li>Prueba con la <b>Lead Ads Testing Tool</b> de Meta. Como la Página es tuya, basta el modo desarrollo; solo necesitarías verificación del negocio y revisión de Meta para conectar Páginas de terceros.</li>
            <li>En cada formulario instantáneo añade el enlace a tu <b>/privacidad</b> y, si quieres publicidad, casillas personalizadas opcionales que contengan «email» o «whatsapp» en su clave.</li>
          </ol>
        </details>
      </CardContent>
    </Card>
  );
}

function Channels() {
  const [d, setD] = useState(null);
  const [testing, setTesting] = useState(false);
  const load = useCallback(() => cap('channels').then(setD).catch(onError), []);
  useEffect(() => { load(); }, [load]);
  if (!d) return <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  const Row = ({ k, v, testid }) => <div className="flex justify-between gap-2 text-sm"><span className="text-muted-foreground">{k}</span><span className="text-right font-medium" data-testid={testid}>{v}</span></div>;
  const forms = d.meta.forms || [];
  return (
    <div className="space-y-4" data-testid="capture-channels">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card data-testid="cap-card-web">
          <CardHeader className="pb-3"><div className="flex items-center justify-between gap-2"><CardTitle className="flex items-center gap-2 text-base"><Globe className="h-4 w-4" />Formulario web</CardTitle>
            <Badge variant="outline" className={d.web.enabled ? STATE.connected.cls : STATE.pending_config.cls} data-testid="cap-web-state">{d.web.enabled ? 'Funcionando' : 'Desactivado'}</Badge></div></CardHeader>
          <CardContent className="space-y-2">
            <ChannelToggle channel="web" enabled={d.web.enabled} onChange={load} />
            <Row k="Leads recibidos" v={d.web.count} testid="cap-web-count" />
            <Row k="Último lead" v={fmtDateTime(d.web.lastAt)} />
            <Row k="Última prueba" v={fmtDateTime(d.web.lastTestAt)} />
            <Row k="Cloudflare Turnstile" v={d.web.turnstile === 'configured' ? <span className="text-emerald-700"><ShieldCheck className="mr-1 inline h-4 w-4" />Activo</span> : <span className="text-muted-foreground"><ShieldAlert className="mr-1 inline h-4 w-4" />No usado (solo protección invisible)</span>} testid="cap-web-turnstile" />
            <p className="text-xs text-muted-foreground">Páginas: /contacto, /demo y la home. Protección invisible activa (campo trampa, tiempo mínimo y límite de envíos).</p>
            <Button variant="outline" size="sm" disabled={testing} data-testid="cap-web-test" onClick={async () => {
              setTesting(true);
              try { const r = await cap('web-test', { method: 'POST' }); toast.success(`Prueba correcta: el formulario valida y llegaría al CRM (${r.wouldBe === 'created' ? 'lead nuevo' : r.wouldBe === 'updated' ? 'actualizaría un lead' : 'revisión manual'}). No se ha creado ningún lead.`); load(); } catch (e) { onError(e); } finally { setTesting(false); }
            }}>{testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Prueba de funcionamiento</Button>
          </CardContent>
        </Card>
        {[['facebook', Facebook, 'Facebook Lead Ads'], ['instagram', Instagram, 'Instagram Lead Ads']].map(([key, Icon, title]) => {
          const c = d[key];
          return (
            <Card key={key} data-testid={`cap-card-${key}`}>
              <CardHeader className="pb-3"><div className="flex items-center justify-between gap-2"><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4" />{title}</CardTitle><StateBadge state={c.state} testid={`cap-${key}-state`} /></div></CardHeader>
              <CardContent className="space-y-2">
                <ChannelToggle channel={key} enabled={c.enabled} onChange={load} />
                <Row k={key === 'instagram' ? 'Cuenta vinculada' : 'Página conectada'} v={key === 'instagram' ? (c.account?.username ? `@${c.account.username}` : '—') : (d.meta.page?.name || '—')} />
                <Row k="Leads recibidos" v={c.count} testid={`cap-${key}-count`} />
                <Row k="Último lead" v={fmtDateTime(c.lastAt)} />
                <Row k="Última sincronización" v={fmtDateTime(d.meta.lastSyncAt)} />
                <Row k="Formularios disponibles" v={d.meta.state === 'pending_config' ? '—' : forms.length} />
                {forms.length > 0 && <ul className="max-h-28 overflow-auto rounded border p-2 text-xs">{forms.map((f) => <li key={f.id} className="flex justify-between gap-2"><span className="truncate">{f.name}</span><span className="text-muted-foreground">{f.status}</span></li>)}</ul>}
                {d.meta.formsError && <p className="text-xs text-amber-700">{d.meta.formsError}</p>}
                {d.meta.recentErrors.length > 0 && <p className="text-xs text-rose-700">{d.meta.recentErrors.length} lead(s) con error de descarga · se reintentan cada 15 min</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <MetaSetup meta={d.meta} reload={load} />
      <LegalCard />
    </div>
  );
}

// ------------------------------------------------------------------ Eventos
function Events() {
  const [f, setF] = useState({ status: '', channel: '', page: 1 });
  const [d, setD] = useState(null);
  const load = useCallback(() => {
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
    cap(`events?${qs}`).then(setD).catch(onError);
  }, [f]);
  useEffect(() => { load(); }, [load]);
  const pages = d ? Math.max(1, Math.ceil(d.total / d.pageSize)) : 1;
  return (
    <div className="space-y-3" data-testid="capture-events">
      <div className="flex flex-wrap gap-2">
        <select className={SELECT} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value, page: 1 })} data-testid="cap-ev-status">
          <option value="">Todos los estados</option>{Object.entries(EV_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select className={SELECT} value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value, page: 1 })} data-testid="cap-ev-channel">
          <option value="">Todos los canales</option><option value="web">Formulario web</option><option value="meta">Meta (todos)</option><option value="facebook">Facebook</option><option value="instagram">Instagram</option>
        </select>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-1 h-4 w-4" />Actualizar</Button>
        {d && <span className="self-center text-sm text-muted-foreground">{d.total} eventos</span>}
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Recibido</TableHead><TableHead>Canal</TableHead><TableHead>Estado</TableHead><TableHead>Solicitud</TableHead><TableHead>Formulario / campaña</TableHead><TableHead>Lead</TableHead><TableHead>Detalle</TableHead></TableRow></TableHeader>
          <TableBody>
            {(d?.rows || []).map((e) => {
              const [l, cls] = EV_STATUS[e.status] || [e.status, ''];
              return (
                <TableRow key={e.id} data-testid={`cap-ev-${e.id}`}>
                  <TableCell className="whitespace-nowrap text-xs">{fmtDateTime(e.received_at)}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{e.channel_label}</TableCell>
                  <TableCell><Badge variant="outline" className={cls}>{l}</Badge></TableCell>
                  <TableCell className="text-sm">{e.request_label || '—'}</TableCell>
                  <TableCell className="max-w-[220px] truncate text-xs">{[e.form_name || e.form_id, e.campaign_name, e.ad_name].filter(Boolean).join(' · ') || '—'}</TableCell>
                  <TableCell className="text-sm">{e.lead ? leadName(e.lead) : '—'}</TableCell>
                  <TableCell className="max-w-[260px] text-xs">
                    {e.error ? <span className="text-rose-700">{e.error}</span> : e.review_reason || (e.attempts > 1 ? `${e.attempts} intentos` : '')}
                    {e.status === 'failed' && e.channel === 'meta' && <Button size="sm" variant="link" className="h-auto p-0 pl-1" onClick={async () => { try { const r = await cap(`events/${e.id}/retry`, { method: 'POST' }); toast[r.status === 'failed' ? 'error' : 'success'](r.status === 'failed' ? (r.error || 'Sigue fallando') : 'Reprocesado'); load(); } catch (er) { onError(er); } }}>Reintentar</Button>}
                  </TableCell>
                </TableRow>
              );
            })}
            {d && !d.rows.length && <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">Sin eventos todavía.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      {pages > 1 && <div className="flex items-center justify-end gap-2 text-sm"><Button size="sm" variant="outline" disabled={f.page <= 1} onClick={() => setF({ ...f, page: f.page - 1 })}>Anterior</Button><span>{f.page} / {pages}</span><Button size="sm" variant="outline" disabled={f.page >= pages} onClick={() => setF({ ...f, page: f.page + 1 })}>Siguiente</Button></div>}
      <p className="text-xs text-muted-foreground">El registro de eventos no guarda datos personales (solo identificadores técnicos). Los datos del contacto están en la ficha del lead del CRM.</p>
    </div>
  );
}

// ------------------------------------------------------------------ Revisión
function Review({ onCount }) {
  const [rows, setRows] = useState(null);
  const load = useCallback(() => cap('review').then((r) => { setRows(r.rows); onCount?.(r.rows.length); }).catch(onError), [onCount]);
  useEffect(() => { load(); }, [load]);
  if (!rows) return <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!rows.length) return <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground" data-testid="cap-review-empty">No hay coincidencias pendientes de revisar.</p>;
  const act = async (id, decision) => { try { await cap(`review/${id}/resolve`, { method: 'POST', body: { decision } }); toast.success('Revisión guardada'); load(); } catch (e) { onError(e); } };
  return (
    <div className="space-y-3" data-testid="capture-review">
      {rows.map((r) => (
        <Card key={r.id} data-testid={`cap-review-${r.id}`}>
          <CardContent className="space-y-3 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><b>{r.lead ? leadName(r.lead) : 'Lead'}</b> <span className="text-muted-foreground">· {r.channel_label} · {fmtDateTime(r.received_at)}</span></div>
              <Badge variant="outline" className={EV_STATUS.review[1]}>{r.review_reason}</Badge>
            </div>
            {r.lead && <p className="text-muted-foreground">{[r.lead.first_name, r.lead.last_name].filter(Boolean).join(' ')} · {r.lead.email || 'sin email'} · {r.lead.phone || 'sin teléfono'}</p>}
            {r.matches.length > 0 && (
              <div className="rounded-lg border bg-muted/40 p-2"><p className="mb-1 text-xs font-medium">Coincide con:</p>
                {r.matches.map((m) => <p key={m.id} className="text-xs">{leadName(m)} · {m.email || 'sin email'} · {m.phone || 'sin teléfono'}</p>)}</div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => act(r.id, 'same_person')} data-testid={`cap-review-same-${r.id}`}>Es la misma persona</Button>
              <Button size="sm" variant="outline" onClick={() => act(r.id, 'different_people')} data-testid={`cap-review-diff-${r.id}`}>Son personas distintas</Button>
              <Button size="sm" variant="ghost" onClick={() => act(r.id, 'dismiss')}>Descartar</Button>
            </div>
            <p className="text-xs text-muted-foreground">Nunca se fusionan contactos automáticamente. Si es la misma persona, completa la ficha a mano en el CRM.</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function CaptureView() {
  const [missing, setMissing] = useState(false);
  const [reviewCount, setReviewCount] = useState(null);
  useEffect(() => { cap('channels').catch((e) => { if (e.data?.migrationNeeded) setMissing(true); }); cap('review').then((r) => setReviewCount(r.rows.length)).catch(() => {}); }, []);
  if (missing) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border bg-card p-6 text-center" data-testid="capture-migration-needed">
        <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-2 text-lg font-semibold">Falta activar la captación en la base de datos</h2>
        <p className="mt-1 text-sm text-muted-foreground">Ejecuta <b>migration-captacion.sql</b> en Supabase (SQL Editor → Run). Solo crea una tabla nueva y añade un tipo de actividad.</p>
        <Button asChild className="mt-4"><a href="/migration-captacion.sql" download>Descargar SQL</a></Button>
      </div>
    );
  }
  return (
    <div className="space-y-5" data-testid="capture-view">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Growth Engine</p>
        <h1 className="text-2xl font-semibold tracking-tight">Captación</h1>
        <p className="text-sm text-muted-foreground">Leads de la web, Facebook e Instagram que llegan solos al CRM Comercial. Solo capta y organiza: no envía comunicaciones.</p>
      </div>
      <Tabs defaultValue="summary">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="summary" data-testid="cap-tab-summary">Resumen</TabsTrigger>
          <TabsTrigger value="channels" data-testid="cap-tab-channels">Canales</TabsTrigger>
          <TabsTrigger value="events" data-testid="cap-tab-events">Eventos</TabsTrigger>
          <TabsTrigger value="review" data-testid="cap-tab-review">Revisión{reviewCount ? ` (${reviewCount})` : ''}</TabsTrigger>
        </TabsList>
        <TabsContent value="summary" className="mt-4"><Summary /></TabsContent>
        <TabsContent value="channels" className="mt-4"><Channels /></TabsContent>
        <TabsContent value="events" className="mt-4"><Events /></TabsContent>
        <TabsContent value="review" className="mt-4"><Review onCount={setReviewCount} /></TabsContent>
      </Tabs>
    </div>
  );
}
