import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { bootstrapUser } from './actions';
import DashboardClient from './dashboard-client';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/dashboard');

  const result = await bootstrapUser();
  if (result.error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-lg border bg-rose-50 p-6 text-rose-700">
          <p className="font-semibold">No se pudo cargar tu cuenta</p>
          <p className="mt-2 text-sm">{result.error}</p>
          <a href="/api/auth/logout" className="mt-3 inline-block text-sm underline">Cerrar sesión</a>
        </div>
      </div>
    );
  }

  return <DashboardClient profile={result.profile} tenant={result.tenant} />;
}
