'use client';

import { useApp } from '@/lib/supabase-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useState } from 'react';
import { Mail, MessageCircle, Smartphone, Shield, KeyRound, Webhook } from 'lucide-react';
import BusinessHoursEditor from './BusinessHoursEditor';
import LogoEditor from './LogoEditor';

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
    <div className="space-y-4">
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
      </div>

      {/* Logo del negocio */}
      <LogoEditor tenantId={tenantId} />

      {/* Editor de horarios y vacaciones */}
      <BusinessHoursEditor tenantId={tenantId} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Recordatorios automáticos por email</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2"><Mail className="h-4 w-4 text-indigo-600" /><span className="font-semibold">Recordatorio 24h antes</span></div><Switch defaultChecked /></div>
              <p className="text-xs text-slate-500">Se envía automáticamente un email a tu cliente 24 horas antes de su cita.</p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2"><Mail className="h-4 w-4 text-emerald-600" /><span className="font-semibold">Recordatorio 2h antes</span></div><Switch defaultChecked /></div>
              <p className="text-xs text-slate-500">Se envía un email 2 horas antes de la cita para reducir aún más las ausencias.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
