import Link from 'next/link';
import { signupAction } from '../actions';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import AuthForm from '../auth-form';

export default function SignupPage() {
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
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Crear cuenta</h1>
            <p className="mt-1 text-sm text-slate-500">Empieza a gestionar tus reservas en minutos</p>
            <AuthForm action={signupAction} className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="first_name">Nombre</Label>
                  <Input id="first_name" name="first_name" required />
                </div>
                <div>
                  <Label htmlFor="last_name">Apellidos</Label>
                  <Input id="last_name" name="last_name" />
                </div>
              </div>
              <div>
                <Label htmlFor="business_name">Nombre del negocio</Label>
                <Input id="business_name" name="business_name" placeholder="FisioVital Madrid" required />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required autoComplete="email" />
              </div>
              <div>
                <Label htmlFor="password">Contraseña</Label>
                <Input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
                <p className="mt-1 text-xs text-slate-500">Mínimo 8 caracteres</p>
              </div>
              <Button type="submit" className="w-full">Crear cuenta</Button>
              <p className="text-center text-xs text-slate-500">Te enviaremos un email para confirmar tu cuenta</p>
            </AuthForm>
            <div className="mt-6 text-center text-sm text-slate-600">
              ¿Ya tienes cuenta? <Link href="/auth/login" className="font-medium text-indigo-600 hover:underline">Iniciar sesión</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
