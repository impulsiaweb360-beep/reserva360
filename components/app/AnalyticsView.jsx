'use client';

import { useApp } from '@/lib/supabase-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';

export default function AnalyticsView() {
  const { tenants, appointments, plans } = useApp();

  const industryData = Object.entries(
    tenants.reduce((acc, t) => { acc[t.industry] = (acc[t.industry] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name, value }));

  const planData = plans.map((p) => ({
    name: p.name,
    tenants: tenants.filter((t) => t.plan === p.id).length,
    mrr: tenants.filter((t) => t.plan === p.id && t.status === 'active').length * p.price,
  }));

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#0ea5e9', '#84cc16'];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Distribución por industria</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={industryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {industryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">MRR por plan</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={planData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="tenants" fill="#6366f1" radius={[6, 6, 0, 0]} />
              <Bar dataKey="mrr" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">Reservas totales por tenant</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={tenants.map((t) => ({ name: t.name.slice(0, 14), reservas: appointments.filter((a) => a.tenantId === t.id).length }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="reservas" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
