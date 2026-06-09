'use client';

import { useState, useRef } from 'react';
import { useApp } from '@/lib/supabase-store';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Upload, Trash2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

export default function LogoEditor({ tenantId }) {
  const { tenants, updateTenant } = useApp();
  const tenant = tenants.find((t) => t.id === tenantId);
  const supabase = createSupabaseBrowserClient();
  const [uploading, setUploading] = useState(false);
  const [logoValue, setLogoValue] = useState(tenant?.logo || '');
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast.error('Imagen demasiado grande. Máximo 3MB.');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${tenantId}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('public-logos')
        .upload(path, file, { contentType: file.type, upsert: true });
      if (error) {
        toast.error('Error subiendo logo: ' + error.message + ' — Asegúrate de que el bucket "public-logos" existe y es público.');
        return;
      }
      const { data: pub } = supabase.storage.from('public-logos').getPublicUrl(path);
      const url = pub.publicUrl;
      setLogoValue(url);
      await updateTenant(tenantId, { logo: url });
      toast.success('Logo subido y guardado');
    } catch (err) {
      toast.error('Error: ' + (err.message || err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const saveUrl = async () => {
    await updateTenant(tenantId, { logo: logoValue });
    toast.success('Logo guardado');
  };

  const clearLogo = async () => {
    setLogoValue('');
    await updateTenant(tenantId, { logo: '' });
    toast.success('Logo eliminado');
  };

  const isImageUrl = logoValue && /^https?:\/\//.test(logoValue);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ImageIcon className="h-4 w-4" /> Logo del negocio
        </CardTitle>
        <p className="text-xs text-slate-500">Aparecerá en tu página pública de reservas. Recomendado PNG/JPG cuadrado. Máx 3MB.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border-2 border-slate-200 bg-slate-50 overflow-hidden">
            {isImageUrl ? (
              <img src={logoValue} alt="Logo" className="h-full w-full object-contain p-2" />
            ) : (
              <span className="text-4xl">{logoValue || '✨'}</span>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleFile} className="hidden" />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2">
              <Upload className="h-4 w-4" /> {uploading ? 'Subiendo...' : 'Subir imagen'}
            </Button>
            {logoValue && (
              <Button variant="outline" onClick={clearLogo} className="ml-2 gap-2">
                <Trash2 className="h-4 w-4" /> Quitar
              </Button>
            )}
          </div>
        </div>

        <div className="border-t pt-4">
          <Label className="text-xs">O introduce una URL pública (o un emoji)</Label>
          <div className="mt-1 flex gap-2">
            <Input value={logoValue} onChange={(e) => setLogoValue(e.target.value)} placeholder="https://... o un emoji ✨" />
            <Button onClick={saveUrl}>Guardar</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
