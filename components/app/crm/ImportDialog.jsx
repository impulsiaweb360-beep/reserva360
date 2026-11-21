'use client';

// Importación CSV: leer archivo → mapear columnas → vista previa validada en servidor → confirmar
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, FileUp, ShieldCheck } from 'lucide-react';
import { CSV_FIELDS, CRM_SOURCES, LEGAL_BASES } from '@/lib/crm/constants';
import { crm } from './shared';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

// Parser CSV con comillas; detecta ; , o tabulador
export function parseCsv(text) {
  const src = text.replace(/^\uFEFF/, '');
  const first = src.split(/\r?\n/)[0] || '';
  const delim = [';', ',', '\t'].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ''));
}

const STATUS = {
  create: ['Se creará', 'bg-emerald-100 text-emerald-800 border-emerald-200'],
  update: ['Se actualizará', 'bg-sky-100 text-sky-800 border-sky-200'],
  duplicate: ['Duplicado: se omite', 'bg-amber-100 text-amber-800 border-amber-200'],
  file_duplicate: ['Repetido en el archivo', 'bg-amber-100 text-amber-800 border-amber-200'],
  invalid: ['Con errores', 'bg-rose-100 text-rose-800 border-rose-200'],
  blocked: ['Bloqueado (no contactar)', 'bg-zinc-200 text-zinc-800 border-zinc-300'],
};
const IGNORE = '__ignore__';

export default function ImportDialog({ open, onOpenChange, onDone }) {
  const [file, setFile] = useState(null);
  const [table, setTable] = useState(null); // { headers, rows }
  const [map, setMap] = useState({});
  const [mode, setMode] = useState('skip');
  const [meta, setMeta] = useState({ source: 'other', source_detail: '', legal_basis: 'legitimate_interest', data_origin: '' });
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const reset = () => { setFile(null); setTable(null); setMap({}); setPreview(null); setMode('skip'); setMeta({ source: 'other', source_detail: '', legal_basis: 'legitimate_interest', data_origin: '' }); };
  const close = (o) => { if (!o) reset(); onOpenChange(o); };

  async function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2_000_000) { toast.error('Archivo demasiado grande (máx. 2 MB)'); return; }
    const rows = parseCsv(await f.text());
    if (rows.length < 2) { toast.error('El CSV no tiene filas de datos'); return; }
    const headers = rows[0].map((h) => String(h).trim());
    const auto = {};
    headers.forEach((h, i) => {
      const hit = CSV_FIELDS.find((fd) => fd.aliases.some((a) => norm(a) === norm(h)));
      auto[i] = hit && !Object.values(auto).includes(hit.key) ? hit.key : IGNORE;
    });
    setFile(f); setTable({ headers, rows: rows.slice(1) }); setMap(auto); setPreview(null);
  }

  const objects = () => table.rows.map((r) => {
    const o = {};
    Object.entries(map).forEach(([i, k]) => { if (k !== IGNORE) o[k] = r[Number(i)] ?? ''; });
    return o;
  });

  async function runPreview() {
    setBusy(true);
    try { setPreview(await crm('import/preview', { method: 'POST', body: { rows: objects(), mode } })); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }
  async function commit() {
    setBusy(true);
    try {
      const r = await crm('import/commit', { method: 'POST', body: { rows: objects(), mode, ...meta, fileName: file?.name || null } });
      toast.success(`Importación terminada: ${r.created} creados, ${r.updated} actualizados, ${r.skipped} omitidos${r.failed ? `, ${r.failed} con error` : ''}`);
      onDone?.(); close(false);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }

  const willWrite = preview ? (preview.summary.create || 0) + (preview.summary.update || 0) : 0;
  const metaOk = meta.data_origin.trim().length >= 5;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto" data-testid="crm-import-dialog">
        <DialogHeader>
          <DialogTitle>Importar leads desde CSV</DialogTitle>
          <DialogDescription>Solo se crean leads del CRM; nunca se tocan usuarios ni negocios reales. Nada se guarda hasta que confirmes.</DialogDescription>
        </DialogHeader>

        {!table ? (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center hover:bg-muted/30">
            <FileUp className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">Elige un archivo .csv</span>
            <span className="text-xs text-muted-foreground">Columnas reconocidas: {CSV_FIELDS.map((f) => f.label).join(', ')}. Máx. 1000 filas.</span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} data-testid="crm-import-file" />
          </label>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-semibold">1. Columnas ({file?.name} · {table.rows.length} filas)</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {table.headers.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border p-2">
                    <span className="w-28 shrink-0 truncate text-xs font-medium" title={h}>{h || `Columna ${i + 1}`}</span>
                    <Select value={map[i]} onValueChange={(v) => { setMap((m) => ({ ...m, [i]: v })); setPreview(null); }}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value={IGNORE}>No importar</SelectItem>{CSV_FIELDS.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="mb-1 flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-emerald-600" />2. Origen legal de los datos (obligatorio)</p>
              <p className="mb-3 text-xs text-muted-foreground">Los datos importados deben tener un origen legítimo y documentado. El consentimiento no se puede asignar en bloque.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label className="text-xs">Fuente</Label>
                  <Select value={meta.source} onValueChange={(v) => setMeta({ ...meta, source: v })}><SelectTrigger data-testid="crm-import-source"><SelectValue /></SelectTrigger><SelectContent>{CRM_SOURCES.filter((s) => s.id !== 'app_signup').map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Base jurídica</Label>
                  <Select value={meta.legal_basis} onValueChange={(v) => setMeta({ ...meta, legal_basis: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LEGAL_BASES.filter((l) => !['consent', 'contract'].includes(l.id)).map((l) => <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">¿De dónde proceden estos datos?</Label>
                  <Input value={meta.data_origin} onChange={(e) => setMeta({ ...meta, data_origin: e.target.value })} placeholder="Ej.: contactos de la feria Beauty Madrid 2026, entregados en persona" data-testid="crm-import-origin" />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5"><Label className="text-xs">3. Si el email ya existe en el CRM</Label>
                <Select value={mode} onValueChange={(v) => { setMode(v); setPreview(null); }}><SelectTrigger className="w-64" data-testid="crm-import-mode"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="skip">Omitirlo (no tocar el existente)</SelectItem><SelectItem value="update">Completar sus datos con el CSV</SelectItem></SelectContent></Select>
              </div>
              <Button variant="outline" onClick={runPreview} disabled={busy} data-testid="crm-import-preview">{busy && !preview && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ver vista previa</Button>
            </div>

            {preview && (
              <div className="space-y-2" data-testid="crm-import-summary">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(preview.summary).map(([k, v]) => <Badge key={k} variant="outline" className={STATUS[k]?.[1]} data-testid={`crm-import-count-${k}`}>{STATUS[k]?.[0]}: {v}</Badge>)}
                </div>
                <div className="max-h-72 overflow-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted"><tr><th className="p-2 text-left">#</th><th className="p-2 text-left">Negocio / contacto</th><th className="p-2 text-left">Email</th><th className="p-2 text-left">Teléfono</th><th className="p-2 text-left">Resultado</th></tr></thead>
                    <tbody>
                      {preview.rows.map((r) => (
                        <tr key={r.index} className="border-t align-top">
                          <td className="p-2 text-muted-foreground">{r.index + 2}</td>
                          <td className="p-2">{r.data.business_name || [r.data.first_name, r.data.last_name].filter(Boolean).join(' ') || '—'}</td>
                          <td className="p-2">{r.data.email || '—'}</td>
                          <td className="p-2">{r.data.phone || '—'}</td>
                          <td className="p-2">
                            <Badge variant="outline" className={STATUS[r.status]?.[1]}>{STATUS[r.status]?.[0]}</Badge>
                            {[...r.errors, ...r.warnings].map((m, i) => <p key={i} className="mt-1 text-muted-foreground">{m}</p>)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {table && <Button variant="ghost" onClick={reset}>Elegir otro archivo</Button>}
          <Button variant="outline" onClick={() => close(false)} data-testid="crm-import-cancel">Cancelar</Button>
          {preview && (
            <Button onClick={commit} disabled={busy || !willWrite || !metaOk} data-testid="crm-import-commit">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{metaOk ? `Importar ${willWrite} leads` : 'Indica el origen de los datos'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
