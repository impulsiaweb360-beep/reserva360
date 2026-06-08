import Link from 'next/link';
import { forgotPasswordAction } from '../actions';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import AuthForm from '../auth-form';

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="p-8">
          <h1 className="text-2xl font-bold">Recuperar contraseña</h1>
          <p className="mt-1 text-sm text-slate-500">Te enviaremos un enlace para restablecerla</p>
          <AuthForm action={forgotPasswordAction} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <Button type="submit" className="w-full">Enviar enlace</Button>
          </AuthForm>
          <div className="mt-6 text-center text-sm">
            <Link href="/auth/login" className="text-indigo-600 hover:underline">Volver a iniciar sesión</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
