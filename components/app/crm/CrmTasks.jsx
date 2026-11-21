'use client';

// Tareas comerciales internas (sin notificaciones externas)
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Plus, CheckCircle2, XCircle, RotateCcw, AlertTriangle } from 'lucide-react';
import { TASK_TYPES, taskTypeLabel } from '@/lib/crm/constants';
import { crm, leadName, fmtDateTime, isOverdue, PriorityBadge, fromLocalInput } from './shared';

const NONE = '__none__';

export default function CrmTasks({ rev, onOpenLead, onError, onChanged }) {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(0);

  useEffect(() => {
    const p = new URLSearchParams();
    if (status === 'overdue') p.set('overdue', '1'); else if (status !== 'all') p.set('status', status);
    setRows(null);
    crm(`tasks?${p}`).then((r) => setRows(r.rows)).catch(onError);
  }, [status, rev, local, onError]);

  async function setTaskStatus(t, s) {
    try { await crm(`tasks/${t.id}`, { method: 'PATCH', body: { status: s } }); toast.success({ completed: 'Tarea completada', cancelled: 'Tarea cancelada', pending: 'Tarea reabierta' }[s]); setLocal((x) => x + 1); onChanged?.(); }
    catch (e) { toast.error(e.message); }
  }

  return (
    <div className="space-y-3 pt-2" data-testid="crm-tasks">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="pending" data-testid="crm-tasks-pending">Pendientes</TabsTrigger>
            <TabsTrigger value="overdue" data-testid="crm-tasks-overdue">Vencidas</TabsTrigger>
            <TabsTrigger value="completed" data-testid="crm-tasks-completed">Completadas</TabsTrigger>
            <TabsTrigger value="cancelled" data-testid="crm-tasks-cancelled">Canceladas</TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={() => setOpen(true)} data-testid="crm-task-new"><Plus className="mr-2 h-4 w-4" />Nueva tarea</Button>
      </div>
      <Card>
        <CardContent className="divide-y p-0">
          {!rows && <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}
          {rows?.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No hay tareas en esta vista.</p>}
          {rows?.map((t) => {
            const late = t.status === 'pending' && isOverdue(t.due_at);
            return (
              <div key={t.id} className={`flex flex-wrap items-center justify-between gap-3 p-4 ${late ? 'bg-rose-50/50' : ''}`} data-testid={`crm-task-${t.id}`}>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${t.status !== 'pending' ? 'text-muted-foreground line-through' : ''}`}>{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {taskTypeLabel(t.task_type)} · {t.crm_leads ? <button className="underline-offset-2 hover:underline" onClick={() => onOpenLead(t.crm_leads.id)}>{leadName(t.crm_leads)}</button> : 'Sin lead'}
                    {' · '}<span className={late ? 'font-medium text-rose-700' : ''}>{late && <AlertTriangle className="mr-0.5 inline h-3 w-3" />}{t.due_at ? `vence ${fmtDateTime(t.due_at)}` : 'sin fecha'}</span>
                    {' · creada '}{fmtDateTime(t.created_at)}
                  </p>
                  {t.description && <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <PriorityBadge priority={t.priority} />
                  {t.status === 'pending' ? (
                    <>
                      <Button size="sm" variant="ghost" className="text-emerald-700" onClick={() => setTaskStatus(t, 'completed')} data-testid={`crm-task-complete-${t.id}`}><CheckCircle2 className="mr-1 h-4 w-4" />Completar</Button>
                      <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => setTaskStatus(t, 'cancelled')} data-testid={`crm-task-cancel-${t.id}`}><XCircle className="mr-1 h-4 w-4" />Cancelar</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setTaskStatus(t, 'pending')}><RotateCcw className="mr-1 h-4 w-4" />Reabrir</Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
      <TaskForm open={open} onOpenChange={setOpen} onSaved={() => { setLocal((x) => x + 1); onChanged?.(); }} />
    </div>
  );
}

function TaskForm({ open, onOpenChange, onSaved }) {
  const [f, setF] = useState({ title: '', description: '', task_type: 'contact', priority: 'medium', due_at: '', lead_id: NONE });
  const [leads, setLeads] = useState([]);
  const [lq, setLq] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => { crm(`leads?pageSize=20&sort=updated_at${lq ? `&q=${encodeURIComponent(lq)}` : ''}`).then((r) => setLeads(r.rows)).catch(() => {}); }, 250);
    return () => clearTimeout(t);
  }, [open, lq]);
  async function save() {
    setSaving(true);
    try {
      await crm('tasks', { method: 'POST', body: { ...f, due_at: fromLocalInput(f.due_at), lead_id: f.lead_id === NONE ? null : f.lead_id } });
      toast.success('Tarea creada'); onSaved(); onOpenChange(false);
      setF({ title: '', description: '', task_type: 'contact', priority: 'medium', due_at: '', lead_id: NONE });
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="crm-task-form">
        <DialogHeader><DialogTitle>Nueva tarea comercial</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label className="text-xs">Título</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} data-testid="crm-task-title" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label className="text-xs">Tipo</Label><Select value={f.task_type} onValueChange={(v) => setF({ ...f, task_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TASK_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-xs">Prioridad</Label><Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v })}><SelectTrigger data-testid="crm-task-priority"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="high">Alta</SelectItem><SelectItem value="medium">Media</SelectItem><SelectItem value="low">Baja</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-xs">Vencimiento</Label><Input type="datetime-local" value={f.due_at} onChange={(e) => setF({ ...f, due_at: e.target.value })} data-testid="crm-task-due" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Lead relacionado</Label>
              <Select value={f.lead_id} onValueChange={(v) => setF({ ...f, lead_id: v })}>
                <SelectTrigger data-testid="crm-task-lead"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <div className="p-1"><Input className="h-8" placeholder="Buscar lead…" value={lq} onChange={(e) => setLq(e.target.value)} onKeyDown={(e) => e.stopPropagation()} /></div>
                  <SelectItem value={NONE}>Sin lead</SelectItem>
                  {leads.map((l) => <SelectItem key={l.id} value={l.id}>{leadName(l)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Descripción</Label><Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !f.title.trim()} data-testid="crm-task-save">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Crear tarea</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
