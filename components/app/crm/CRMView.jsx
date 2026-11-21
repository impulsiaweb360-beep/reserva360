'use client';

// Growth Engine → CRM Comercial (solo Super Admin)
import { useCallback, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, Loader2, Contact } from 'lucide-react';
import { toast } from 'sonner';
import { crm } from './shared';
import CrmDashboard from './CrmDashboard';
import CrmLeads from './CrmLeads';
import CrmPipeline from './CrmPipeline';
import CrmTasks from './CrmTasks';
import CrmActivities from './CrmActivities';
import LeadDetail from './LeadDetail';
import LeadForm from './LeadForm';

export default function CRMView() {
  const [tab, setTab] = useState('dashboard');
  const [leadId, setLeadId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [rev, setRev] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [missing, setMissing] = useState(false);
  const bump = useCallback(() => setRev((r) => r + 1), []);
  const openLead = useCallback((id) => setLeadId(id), []);
  const onError = useCallback((e) => { if (e?.data?.migrationNeeded) setMissing(true); else toast.error(e.message); }, []);

  async function sync() {
    setSyncing(true);
    try {
      const r = await crm('sync', { method: 'POST' });
      toast.success(`Sincronizado: ${r.created || 0} negocios nuevos, ${r.stageUpdated || 0} etapas actualizadas${r.needsReview ? `, ${r.needsReview} por revisar` : ''}`);
      bump();
    } catch (e) { onError(e); } finally { setSyncing(false); }
  }

  if (missing) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border bg-card p-6 text-center" data-testid="crm-migration-needed">
        <Contact className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-2 text-lg font-semibold">Falta activar el CRM en la base de datos</h2>
        <p className="mt-1 text-sm text-muted-foreground">Ejecuta el archivo <b>migration-crm.sql</b> en Supabase (SQL Editor → Run). Solo crea tablas nuevas; no toca nada existente.</p>
        <Button asChild className="mt-4"><a href="/migration-crm.sql" download>Descargar SQL</a></Button>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="crm-view">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Growth Engine</p>
          <h1 className="text-2xl font-semibold tracking-tight">CRM Comercial</h1>
          <p className="text-sm text-muted-foreground">Seguimiento interno de leads y oportunidades. No envía comunicaciones.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={sync} disabled={syncing} data-testid="crm-sync">
            {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Sincronizar con la app
          </Button>
          <Button onClick={() => setFormOpen(true)} data-testid="crm-new-lead"><Plus className="mr-2 h-4 w-4" />Nuevo lead</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
          <TabsTrigger value="dashboard" data-testid="crm-tab-dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="leads" data-testid="crm-tab-leads">Leads</TabsTrigger>
          <TabsTrigger value="pipeline" data-testid="crm-tab-pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="tasks" data-testid="crm-tab-tasks-main">Tareas</TabsTrigger>
          <TabsTrigger value="activities" data-testid="crm-tab-activities">Actividades</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard"><CrmDashboard rev={rev} onOpenLead={openLead} onError={onError} onGo={setTab} /></TabsContent>
        <TabsContent value="leads"><CrmLeads rev={rev} onOpenLead={openLead} onError={onError} onChanged={bump} /></TabsContent>
        <TabsContent value="pipeline"><CrmPipeline rev={rev} onOpenLead={openLead} onError={onError} onChanged={bump} /></TabsContent>
        <TabsContent value="tasks"><CrmTasks rev={rev} onOpenLead={openLead} onError={onError} onChanged={bump} /></TabsContent>
        <TabsContent value="activities"><CrmActivities rev={rev} onOpenLead={openLead} onError={onError} /></TabsContent>
      </Tabs>

      <LeadDetail leadId={leadId} open={Boolean(leadId)} onOpenChange={(o) => !o && setLeadId(null)} onChanged={bump} />
      <LeadForm open={formOpen} onOpenChange={setFormOpen} lead={null} onSaved={(l) => { bump(); if (l?.id) setLeadId(l.id); }} />
    </div>
  );
}
