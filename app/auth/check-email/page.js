import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Mail } from 'lucide-react';

export default function CheckEmailPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
            <Mail className="h-8 w-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold">Confirma tu email</h1>
          <p className="mt-2 text-sm text-slate-600">
            Te hemos enviado un enlace de confirmación. Revisa tu bandeja de entrada (y la carpeta de spam) y haz clic en el enlace para activar tu cuenta.
          </p>
          <Link href="/auth/login" className="mt-6 inline-block text-sm text-indigo-600 hover:underline">Volver a iniciar sesión</Link>
        </CardContent>
      </Card>
    </div>
  );
}
