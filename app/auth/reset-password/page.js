import { resetPasswordAction } from '../actions';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import AuthForm from '../auth-form';

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="p-8">
          <h1 className="text-2xl font-bold">Nueva contraseña</h1>
          <p className="mt-1 text-sm text-slate-500">Elige una nueva contraseña para tu cuenta</p>
          <AuthForm action={resetPasswordAction} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="password">Nueva contraseña</Label>
              <Input id="password" name="password" type="password" minLength={8} required />
            </div>
            <Button type="submit" className="w-full">Actualizar</Button>
          </AuthForm>
        </CardContent>
      </Card>
    </div>
  );
}
