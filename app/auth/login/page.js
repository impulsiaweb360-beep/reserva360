import Link from 'next/link';
import { loginAction } from '../actions';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import AuthForm from '../auth-form';

export default function LoginPage({ searchParams }) {
  const next = searchParams?.next || '/dashboard';
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex flex-col">
      <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center px-6">
          <Link href="/"><img src="/logo-reserva360.png" alt="Reserva360" className="h-9 w-auto" /></Link>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Iniciar sesión</h1>
            <p className="mt-1 text-sm text-slate-500">Accede a tu cuenta de Reserva360</p>
            <AuthForm action={loginAction} className="mt-6 space-y-4">
              <input type="hidden" name="next" value={next} />
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required autoComplete="email" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Contraseña</Label>
                  <Link href="/auth/forgot-password" className="text-xs text-indigo-600 hover:underline">¿Olvidaste tu contraseña?</Link>
                </div>
                <Input id="password" name="password" type="password" required autoComplete="current-password" />
              </div>
              <Button type="submit" className="w-full">Iniciar sesión</Button>
            </AuthForm>
            <div className="mt-6 text-center text-sm text-slate-600">
              ¿No tienes cuenta? <Link href="/auth/signup" className="font-medium text-indigo-600 hover:underline">Crear cuenta</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
