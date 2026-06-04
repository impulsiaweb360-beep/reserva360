'use client';

import { useApp } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useState } from 'react';
import { Mail, MessageCircle, Smartphone, Shield, KeyRound, Webhook } from 'lucide-react';

export default function SettingsView({ tenantId }) {
  const { tenants, updateTenant, plans } = useApp();
  const tenant = tenants.find((t) => t.id === tenantId);
  const [form, setForm] = useState({ ...tenant });
  const plan = plans.find((p) => p.id === tenant?.plan);

  const save = () => {
    updateTenant(tenantId, form);
    toast.success('Configuración guardada');
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Datos del negocio</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label className="text-xs">Nombre</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label className="text-xs">Industria</Label><Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label className="text-xs">Teléfono</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div><Label className="text-xs">Dirección</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <Button onClick={save}>Guardar cambios</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Suscripción</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-semibold">Plan {plan?.name}</div>
              <div className="text-xs text-slate-500">{plan?.price}€/{plan?.interval}</div>
            </div>
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Activo</Badge>
          </div>
          <Button variant="outline" className="w-full">Cambiar de plan</Button>
          <Button variant="outline" className="w-full">Gestionar facturación en Stripe</Button>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">Recordatorios automáticos</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4">
            <div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2"><Mail className="h-4 w-4 text-indigo-600" /><span className="font-semibold">Email</span></div><Switch defaultChecked /></div>
            <p className="text-xs text-slate-500">Confirmación + recordatorios 24h y 2h antes.</p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-emerald-600" /><span className="font-semibold">WhatsApp</span></div><Switch defaultChecked /></div>
            <p className="text-xs text-slate-500">Conectado con Twilio WhatsApp Business.</p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-amber-600" /><span className="font-semibold">SMS</span></div><Switch /></div>
            <p className="text-xs text-slate-500">Disponible en plan Business.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">Seguridad y auditoría</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="flex items-start gap-3 rounded-lg border p-4"><Shield className="h-5 w-5 text-indigo-600" /><div><div className="font-semibold">Row Level Security</div><div className="text-xs text-slate-500">Activo – aislamiento por tenant_id</div></div></div>
            <div className="flex items-start gap-3 rounded-lg border p-4"><KeyRound className="h-5 w-5 text-emerald-600" /><div><div className="font-semibold">Auditoría</div><div className="text-xs text-slate-500">Todos los cambios registrados</div></div></div>
            <div className="flex items-start gap-3 rounded-lg border p-4"><Webhook className="h-5 w-5 text-amber-600" /><div><div className="font-semibold">Rate limiting</div><div className="text-xs text-slate-500">100 req/min por tenant</div></div></div>
        </CardContent>
      </Card>
    </div>
  );
}
