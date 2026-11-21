'use client';

// Registro global de actividades comerciales (solo lectura; se añaden desde la ficha del lead)
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { ACTIVITY_TYPES, activityLabel } from '@/lib/crm/constants';
import { crm, leadName, fmtDateTime } from './shared';

const ALL = '__all__';

export default function CrmActivities({ rev, onOpenLead, onError }) {
  const [type, setType] = useState(ALL);
  const [data, setData] = useState(null);
  useEffect(() => {
    setData(null);
    crm(`activities${type !== ALL ? `?type=${type}` : ''}`).then(setData).catch(onError);
  }, [type, rev, onError]);
  return (
    <div className="space-y-3 pt-2" data-testid="crm-activities">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-64" data-testid="crm-activities-type"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>Todas las actividades</SelectItem>{ACTIVITY_TYPES.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}</SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Para registrar una llamada o nota, abre la ficha del lead.</p>
      </div>
      <Card>
        <CardContent className="divide-y p-0">
          {!data && <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}
          {data?.rows.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Sin actividades.</p>}
          {data?.rows.map((a) => (
            <div key={a.id} className="flex flex-wrap items-start justify-between gap-2 p-4" data-testid={`crm-activity-${a.id}`}>
              <div className="min-w-0 flex-1">
                <p className="text-sm"><span className="font-medium">{activityLabel(a.type)}</span>{a.crm_leads && <> · <button className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => onOpenLead(a.crm_leads.id)}>{leadName(a.crm_leads)}</button></>}</p>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{a.description}</p>
              </div>
              <p className="text-xs text-muted-foreground">{fmtDateTime(a.occurred_at)} · {a.created_by ? data.actors[a.created_by] || 'Admin' : 'Sistema'}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
