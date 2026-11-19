'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/lib/supabase-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  CheckCircle2, Circle, Copy, ExternalLink, Store, Clock, Briefcase, UserRound, Link2, CalendarDays,
  MessageCircle, Bot, Zap, AlertTriangle, LifeBuoy, Lightbulb, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

const copy = (text, msg = 'Copiado') => {
  if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(text);
  toast.success(msg);
};

function Steps({ items }) {
  return (
    <ol className="space-y-3">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{i + 1}</span>
          <div className="pt-0.5 text-sm leading-relaxed text-slate-700">{it}</div>
        </li>
      ))}
    </ol>
  );
}

function Tip({ children, tone = 'info' }) {
  const cls = tone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-indigo-100 bg-indigo-50 text-indigo-900';
  const Icon = tone === 'warn' ? AlertTriangle : Lightbulb;
  return (
    <div className={`mt-4 flex gap-2 rounded-lg border p-3 text-sm ${cls}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function GoButton({ onNavigate, view, children }) {
  if (!onNavigate) return null;
  return (
    <Button variant="outline" size="sm" className="mt-4 gap-1" onClick={() => onNavigate(view)} data-testid={`help-go-${view}`}>
      {children} <ArrowRight className="h-3.5 w-3.5" />
    </Button>
  );
}

function CopyBox({ label, text, testid }) {
  return (
    <div className="mt-3 rounded-lg border bg-white">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => copy(text, 'Texto copiado')} data-testid={testid}>
          <Copy className="h-3.5 w-3.5" /> Copiar
        </Button>
      </div>
      <pre className="whitespace-pre-wrap break-words p-3 font-sans text-sm text-slate-800">{text}</pre>
    </div>
  );
}

const B = ({ children }) => <b className="font-semibold text-slate-900">{children}</b>;

export default function HelpView({ tenantId, onNavigate }) {
  const { tenants, byTenant } = useApp();
  const tenant = tenants.find((t) => t.id === tenantId);
  const services = byTenant('services', tenantId);
  const employees = byTenant('employees', tenantId);
  const appointments = byTenant('appointments', tenantId);
  const [open, setOpen] = useState(['inicio']);

  const bookingUrl = typeof window !== 'undefined' && tenant?.slug ? `${window.location.origin}/book/${tenant.slug}` : `/book/${tenant?.slug || 'tu-negocio'}`;
  const name = tenant?.name || 'nuestro negocio';

  const checklist = useMemo(() => ([
    { done: !!(tenant?.name && (tenant?.phone || tenant?.address)), label: 'Datos del negocio (nombre, teléfono, dirección)', view: 'settings', section: 'negocio' },
    { done: !!tenant?.businessHours && Object.keys(tenant.businessHours || {}).length > 0, label: 'Horario de apertura', view: 'settings', section: 'horario' },
    { done: services.length > 0, label: `Servicios creados (${services.length})`, view: 'services', section: 'servicios' },
    { done: employees.length > 0, label: `Profesionales dados de alta (${employees.length})`, view: 'employees', section: 'empleados' },
    { done: appointments.length > 0, label: 'Primera reserva recibida', view: 'calendar', section: 'enlace' },
  ]), [tenant, services.length, employees.length, appointments.length]);
  const doneCount = checklist.filter((c) => c.done).length;

  const welcomeMsg = `¡Hola! 👋 Gracias por escribir a ${name}.\n\nPuedes reservar tu cita en cualquier momento, eligiendo servicio, profesional, día y hora, aquí:\n${bookingUrl}\n\nRecibirás la confirmación al momento y un enlace para cambiarla o cancelarla. Si prefieres, escríbenos y te atendemos en cuanto podamos.`;
  const quickReply = `Puedes reservar tu cita aquí en un minuto 👉 ${bookingUrl}\nVerás solo las horas que tenemos libres. ¡Gracias!`;
  const awayMsg = `¡Hola! Ahora mismo estamos cerrados o atendiendo. 🙏\nPuedes reservar tu cita 24 h aquí: ${bookingUrl}`;

  return (
    <div className="space-y-6" data-testid="help-view">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><LifeBuoy className="h-6 w-6 text-indigo-600" /> Ayuda</h1>
        <p className="mt-1 text-sm text-slate-600">Guía paso a paso para dejar tu negocio listo y empezar a recibir reservas por la web y por WhatsApp.</p>
      </div>

      {/* Progreso */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span>Tu configuración</span>
            <Badge variant="outline" className={doneCount === checklist.length ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : ''} data-testid="help-progress">
              {doneCount} de {checklist.length} completados
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {checklist.map((c) => (
              <li key={c.label}>
                <button type="button" onClick={() => setOpen((o) => Array.from(new Set([...o, c.section])))} className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm hover:bg-slate-50">
                  {c.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="h-4 w-4 shrink-0 text-slate-300" />}
                  <span className={c.done ? 'text-slate-500' : 'font-medium text-slate-800'}>{c.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Accordion type="multiple" value={open} onValueChange={setOpen} className="space-y-3">
        {/* 0. Primeros pasos */}
        <AccordionItem value="inicio" className="rounded-xl border bg-white px-4">
          <AccordionTrigger className="text-left font-semibold"><span className="flex items-center gap-2"><Zap className="h-4 w-4 text-indigo-600" /> Empieza aquí: el orden recomendado</span></AccordionTrigger>
          <AccordionContent>
            <Steps items={[
              <>Rellena los <B>datos del negocio</B> y sube tu <B>logo</B> (Configuración).</>,
              <>Define tu <B>horario de apertura</B>, la pausa de mediodía y tus <B>vacaciones</B> (Configuración).</>,
              <>Crea tus <B>servicios</B> con su duración y precio (Servicios).</>,
              <>Da de alta a tus <B>profesionales</B> y, si hace falta, su horario propio (Empleados).</>,
              <>Copia tu <B>enlace de reservas</B> y compártelo: Google, Instagram, web y WhatsApp.</>,
              <>Opcional: activa el <B>chatbot de WhatsApp</B> con YCloud.</>,
            ]} />
            <Tip>Haz una reserva de prueba desde tu propio móvil con el enlace: así ves exactamente lo que verán tus clientes y compruebas que te llegan los avisos.</Tip>
          </AccordionContent>
        </AccordionItem>

        {/* 1. Negocio */}
        <AccordionItem value="negocio" className="rounded-xl border bg-white px-4">
          <AccordionTrigger className="text-left font-semibold"><span className="flex items-center gap-2"><Store className="h-4 w-4 text-indigo-600" /> 1. Datos del negocio y logo</span></AccordionTrigger>
          <AccordionContent>
            <Steps items={[
              <>En el menú, entra en <B>Configuración</B>.</>,
              <>En <B>Datos del negocio</B> escribe el nombre, el sector, el email, el teléfono y la dirección. Aparecen en tu página de reservas y en los avisos.</>,
              <>Pulsa <B>Guardar cambios</B>.</>,
              <>En el apartado del <B>logo</B>, sube la imagen de tu negocio. Se verá en tu página de reservas y en el panel.</>,
            ]} />
            <GoButton onNavigate={onNavigate} view="settings">Ir a Configuración</GoButton>
          </AccordionContent>
        </AccordionItem>

        {/* 2. Horario */}
        <AccordionItem value="horario" className="rounded-xl border bg-white px-4">
          <AccordionTrigger className="text-left font-semibold"><span className="flex items-center gap-2"><Clock className="h-4 w-4 text-indigo-600" /> 2. Horario de apertura, descanso y vacaciones</span></AccordionTrigger>
          <AccordionContent>
            <Steps items={[
              <>En <B>Configuración → Horarios de apertura</B>, activa los días que abres y desactiva los que cierras.</>,
              <>Para cada día indica la hora de <B>apertura</B> y de <B>cierre</B>.</>,
              <>Si cierras a mediodía, añade el <B>descanso</B> (por ejemplo de 14:00 a 15:00). Nadie podrá reservar online en esa franja.</>,
              <>En <B>Vacaciones y días cerrados</B> añade los festivos o tus vacaciones con fecha de inicio y fin.</>,
              <>Pulsa <B>Guardar cambios</B>.</>,
            ]} />
            <Tip>Las reservas online solo ofrecen horas en las que el servicio completo cabe antes del cierre o del descanso. Desde el panel tú sí puedes forzar una cita en el descanso, con confirmación.</Tip>
            <GoButton onNavigate={onNavigate} view="settings">Ir a Configuración</GoButton>
          </AccordionContent>
        </AccordionItem>

        {/* 3. Servicios */}
        <AccordionItem value="servicios" className="rounded-xl border bg-white px-4">
          <AccordionTrigger className="text-left font-semibold"><span className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-indigo-600" /> 3. Servicios: duración y precio</span></AccordionTrigger>
          <AccordionContent>
            <Steps items={[
              <>Entra en <B>Servicios</B> y pulsa <B>Nuevo servicio</B>.</>,
              <>Escribe el <B>nombre</B> como lo entendería tu cliente (por ejemplo «Corte y peinado» o «Sesión de fisioterapia») y una descripción breve.</>,
              <>Indica la <B>duración real en minutos</B>, incluida la preparación. Es lo que el sistema bloquea en la agenda.</>,
              <>Pon el <B>precio</B> y elige un <B>color</B> para reconocerlo en el calendario.</>,
              <>Guarda. Repite con cada servicio. Puedes desactivar un servicio para que deje de mostrarse sin borrarlo.</>,
            ]} />
            <GoButton onNavigate={onNavigate} view="services">Ir a Servicios</GoButton>
          </AccordionContent>
        </AccordionItem>

        {/* 4. Empleados */}
        <AccordionItem value="empleados" className="rounded-xl border bg-white px-4">
          <AccordionTrigger className="text-left font-semibold"><span className="flex items-center gap-2"><UserRound className="h-4 w-4 text-indigo-600" /> 4. Profesionales y sus horarios</span></AccordionTrigger>
          <AccordionContent>
            <Steps items={[
              <>Entra en <B>Empleados</B> y pulsa <B>Invitar empleado</B>.</>,
              <>Escribe nombre, apellidos, email y teléfono, y guarda. Si trabajas solo, date de alta a ti mismo: hace falta al menos un profesional para recibir reservas.</>,
              <>Por defecto cada profesional usa el <B>horario del negocio</B>. Si alguien trabaja otro horario (solo mañanas, libra los lunes…), pulsa el icono de calendario <B>Editar horario</B> de su fila y ajusta sus días y horas.</>,
              <>El cliente podrá elegir profesional al reservar o dejar que se asigne el primero disponible.</>,
            ]} />
            <Tip>Durante el lanzamiento tienes el plan Pro gratis: hasta 3 profesionales.</Tip>
            <GoButton onNavigate={onNavigate} view="employees">Ir a Empleados</GoButton>
          </AccordionContent>
        </AccordionItem>

        {/* 5. Enlace */}
        <AccordionItem value="enlace" className="rounded-xl border bg-white px-4">
          <AccordionTrigger className="text-left font-semibold"><span className="flex items-center gap-2"><Link2 className="h-4 w-4 text-indigo-600" /> 5. Tu enlace de reservas: dónde compartirlo</span></AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-2 rounded-lg border bg-slate-50 p-3 sm:flex-row sm:items-center">
              <code className="flex-1 break-all text-sm font-semibold text-slate-800" data-testid="help-booking-url">{bookingUrl}</code>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-1" onClick={() => copy(bookingUrl, 'Enlace copiado')}><Copy className="h-3.5 w-3.5" /> Copiar</Button>
                <Button size="sm" className="gap-1" onClick={() => window.open(bookingUrl, '_blank')}><ExternalLink className="h-3.5 w-3.5" /> Abrir</Button>
              </div>
            </div>
            <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
              <li><B>Google:</B> en tu Perfil de Empresa de Google, añádelo como enlace de reservas o de sitio web.</li>
              <li><B>Instagram y Facebook:</B> en la biografía y en el botón de acción del perfil.</li>
              <li><B>WhatsApp Business:</B> como mensaje predefinido (mira el apartado siguiente) y en el perfil de empresa, en «Sitio web».</li>
              <li><B>En el local:</B> imprime el código QR que aparece en tu Dashboard y ponlo en la caja o en la puerta.</li>
            </ul>
            <GoButton onNavigate={onNavigate} view="dashboard">Ver el QR en el Dashboard</GoButton>
          </AccordionContent>
        </AccordionItem>

        {/* 6. WhatsApp fácil */}
        <AccordionItem value="wa-facil" className="rounded-xl border-2 border-emerald-200 bg-white px-4">
          <AccordionTrigger className="text-left font-semibold">
            <span className="flex flex-wrap items-center gap-2"><MessageCircle className="h-4 w-4 text-emerald-600" /> 6. WhatsApp, la forma fácil: el enlace como mensaje predefinido <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Recomendado para empezar</Badge></span>
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-sm text-slate-700">
              No necesitas ninguna cuenta nueva. Usa las herramientas gratuitas de la app <B>WhatsApp Business</B> para que, cuando alguien te escriba,
              reciba automáticamente tu enlace de reservas. El cliente reserva solo y la cita aparece en tu calendario.
            </p>

            <h3 className="mt-5 font-semibold text-slate-900">A) Mensaje de bienvenida (se envía solo al primer mensaje)</h3>
            <Steps items={[
              <>Abre la app <B>WhatsApp Business</B> en tu móvil.</>,
              <>Android: pulsa los <B>tres puntos ⋮ → Herramientas para la empresa</B>. iPhone: <B>Configuración → Herramientas para la empresa</B>.</>,
              <>Entra en <B>Mensaje de bienvenida</B> y activa <B>Enviar mensaje de bienvenida</B>.</>,
              <>Toca el mensaje, borra el texto y pega el de abajo. Guarda.</>,
            ]} />
            <CopyBox label="Mensaje de bienvenida" text={welcomeMsg} testid="help-copy-welcome" />

            <h3 className="mt-6 font-semibold text-slate-900">B) Respuesta rápida «/reservar» (para contestar en un segundo)</h3>
            <Steps items={[
              <>En <B>Herramientas para la empresa → Respuestas rápidas</B>, pulsa <B>+</B> (añadir).</>,
              <>En el mensaje pega el texto de abajo y como atajo escribe <B>reservar</B>. Guarda.</>,
              <>A partir de ahora, en cualquier chat escribe <B>/reservar</B> y elige la respuesta: se envía el enlace.</>,
            ]} />
            <CopyBox label="Respuesta rápida" text={quickReply} testid="help-copy-quick" />

            <h3 className="mt-6 font-semibold text-slate-900">C) Mensaje de ausencia (fuera de tu horario)</h3>
            <Steps items={[
              <>En <B>Herramientas para la empresa → Mensaje de ausencia</B>, actívalo.</>,
              <>Pega el texto de abajo y en <B>Horario</B> elige «Fuera del horario comercial» (o el que prefieras). Guarda.</>,
            ]} />
            <CopyBox label="Mensaje de ausencia" text={awayMsg} testid="help-copy-away" />

            <h3 className="mt-6 font-semibold text-slate-900">D) Enlace en tu perfil de empresa</h3>
            <Steps items={[
              <>En <B>Herramientas para la empresa → Perfil de empresa</B>, toca <B>Sitio web</B>.</>,
              <>Pega tu enlace de reservas y guarda. Aparecerá en tu perfil para cualquiera que lo abra.</>,
            ]} />
            <Tip>Los nombres de los menús pueden variar un poco según la versión de WhatsApp Business y si usas Android o iPhone.</Tip>
          </AccordionContent>
        </AccordionItem>

        {/* 7. WhatsApp YCloud */}
        <AccordionItem value="wa-ycloud" className="rounded-xl border bg-white px-4">
          <AccordionTrigger className="text-left font-semibold">
            <span className="flex flex-wrap items-center gap-2"><Bot className="h-4 w-4 text-indigo-600" /> 7. Chatbot de reservas con YCloud, paso a paso <Badge variant="outline">Plan Pro</Badge></span>
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-sm text-slate-700">
              Con YCloud conectas tu número a la <B>API oficial de WhatsApp Business</B>. Cuando un cliente escribe «hola», el chatbot de Reserva360 le muestra un menú para
              <B> reservar</B>, <B>ver sus citas</B>, <B>cambiar el día o la hora</B> o <B>cancelar</B>, con tus servicios, profesionales y horarios. Además se envían la confirmación, el recordatorio
              24 h antes, los avisos de cambios y un aviso a tu móvil por cada reserva nueva.
            </p>

            <div className="mt-4 rounded-lg border bg-slate-50 p-4 text-sm">
              <p className="font-semibold text-slate-900">Antes de empezar, ten a mano:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
                <li>Una cuenta de <B>Facebook</B> para crear o elegir el <B>portfolio empresarial de Meta</B> de tu negocio.</li>
                <li>El <B>número</B> que vas a usar. Puede ser el que ya usas en la app WhatsApp Business (con «coexistencia» sigues usando la app a la vez; necesitas la versión 2.24.17 o superior) o un número nuevo que no esté en WhatsApp.</li>
                <li>Datos de tu empresa para la <B>verificación de Meta</B> (nombre legal, dirección y una web; puedes usar tu enlace de reservas).</li>
                <li>Una tarjeta para <B>recargar saldo</B> en YCloud: cobra los mensajes que se envían según las tarifas de WhatsApp. Sin saldo, el bot y los avisos dejan de funcionar.</li>
              </ul>
            </div>

            <h3 className="mt-6 font-semibold text-slate-900">Paso 1 · Crea tu cuenta en YCloud</h3>
            <Steps items={[
              <>Entra en <a href="https://www.ycloud.com" target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline">www.ycloud.com</a> y pulsa <B>Sign up</B> (registrarse).</>,
              <>Regístrate con el email de tu negocio, confirma el correo que te envían y completa los datos de la empresa.</>,
              <>Entra en la <B>consola</B> de YCloud con tu usuario y contraseña.</>,
            ]} />

            <h3 className="mt-6 font-semibold text-slate-900">Paso 2 · Conecta tu número de WhatsApp</h3>
            <Steps items={[
              <>En la consola, ve al apartado de <B>WhatsApp</B> y pulsa para crear o conectar un canal.</>,
              <>Elige la opción según tu caso:
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li><B>Ya uso este número en WhatsApp Business</B> → elige <B>WhatsApp Business App Coexistence</B>. Introduce el número, escanea con el móvil el código QR que aparece y decide si sincronizar el historial (si lo haces, deja la app abierta hasta que acabe). <B>No borres tu cuenta de la app.</B></li>
                  <li><B>Número nuevo</B> → elige conectar un número nuevo y verifícalo con el código que te llega por SMS o llamada.</li>
                </ul>
              </>,
              <>Inicia sesión con <B>Facebook</B> cuando te lo pida, y crea o elige el portfolio empresarial y la cuenta de WhatsApp Business de tu negocio.</>,
              <>Pon como <B>nombre visible</B> el de tu negocio (Meta lo revisa) y elige la categoría.</>,
              <>Al terminar, tu número aparecerá en YCloud como conectado.</>,
            ]} />

            <h3 className="mt-6 font-semibold text-slate-900">Paso 3 · Verifica tu empresa y recarga saldo</h3>
            <Steps items={[
              <>En <B>Meta Business Suite → Configuración → Centro de seguridad</B>, inicia la <B>verificación de la empresa</B> con tus datos y documentos. Hazlo directamente en Meta.</>,
              <>En YCloud, ve a la sección de <B>facturación o saldo</B> y añade saldo. Se descuenta en tiempo real por cada mensaje según las tarifas de WhatsApp. Consulta las tarifas vigentes en la propia web de YCloud.</>,
            ]} />

            <h3 className="mt-6 font-semibold text-slate-900">Paso 4 · Copia tu clave API</h3>
            <Steps items={[
              <>En YCloud, abre <B>Developers → API Keys</B>.</>,
              <>Copia la clave. Trátala como una contraseña: no la compartas.</>,
            ]} />

            <h3 className="mt-6 font-semibold text-slate-900">Paso 5 · Conéctalo en Reserva360</h3>
            <Steps items={[
              <>Ve a <B>Configuración → WhatsApp (YCloud)</B>.</>,
              <>Pega la <B>clave API</B> y el <B>número de WhatsApp del negocio</B> con prefijo (por ejemplo +34 600 111 222).</>,
              <>Opcional: el <B>móvil donde quieres recibir el aviso</B> de cada reserva nueva y el <B>prefijo del país</B> de tus clientes (34 para España).</>,
              <>Pulsa <B>Conectar</B>. Reserva360 configura el chatbot y crea automáticamente las plantillas de avisos.</>,
              <>Si aparece <B>«Falta el webhook»</B>, sigue las instrucciones de esa misma tarjeta: en YCloud → Developers → Webhooks crea uno con la URL que te mostramos y los eventos indicados, y pega aquí el secreto.</>,
            ]} />
            <GoButton onNavigate={onNavigate} view="settings">Ir a Configuración → WhatsApp</GoButton>

            <h3 className="mt-6 font-semibold text-slate-900">Paso 6 · Espera la aprobación y prueba</h3>
            <Steps items={[
              <>En la tarjeta de WhatsApp verás las <B>plantillas de avisos</B>. Meta las revisa (normalmente entre minutos y unas horas). Los avisos empiezan a enviarse cuando están <B>Aprobadas</B>.</>,
              <>Desde <B>otro móvil</B>, escribe «hola» a tu número: debe aparecer el menú con <B>Reservar cita</B> y <B>Mis citas</B>.</>,
              <>Haz una reserva de prueba para una fecha futura y comprueba que llega la confirmación con el enlace para cambiarla o cancelarla.</>,
            ]} />

            <h3 className="mt-6 font-semibold text-slate-900">Si algo no funciona</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
              <li><B>El bot no responde:</B> revisa en la tarjeta de WhatsApp que el bot está «Activo» (webhook configurado) y que tienes saldo en YCloud.</li>
              <li><B>No llegan las confirmaciones o recordatorios:</B> las plantillas todavía están pendientes de aprobación por Meta.</li>
              <li><B>«Mis citas» sale vacío:</B> solo se muestran las citas futuras del mismo teléfono desde el que escribe el cliente. Las citas pasadas no aparecen.</li>
              <li><B>El enlace no deja cambiar la cita:</B> ocurre si la cita ya ha pasado o está completada o cancelada.</li>
            </ul>
            <Tip>Puedes combinar las dos formas: activa el chatbot y, además, pon tu enlace de reservas en el perfil y en las respuestas rápidas de WhatsApp Business.</Tip>
          </AccordionContent>
        </AccordionItem>

        {/* 8. Día a día */}
        <AccordionItem value="dia" className="rounded-xl border bg-white px-4">
          <AccordionTrigger className="text-left font-semibold"><span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-indigo-600" /> 8. El día a día: calendario, reservas y cobros</span></AccordionTrigger>
          <AccordionContent>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
              <li><B>Crear una cita:</B> en <B>Calendario</B>, haz clic en un hueco o en <B>Nueva cita</B>.</li>
              <li><B>Mover una cita:</B> en la vista de semana, <B>arrástrala</B> a otra hora o a otro día. Solo se permite dentro del horario del negocio y del profesional.</li>
              <li><B>Modificar o cancelar:</B> haz clic en la cita y pulsa <B>Modificar</B>, o usa el lápiz en <B>Reservas</B>. Si tienes WhatsApp conectado, el cliente recibe el aviso del cambio.</li>
              <li><B>Estados:</B> marca la cita como confirmada, completada o «no asistió». Al marcarla como completada queda también como pagada.</li>
              <li><B>Cobros:</B> usa <B>Marcar pagada</B> en el detalle de la cita y consulta el resumen en <B>Pagos</B> y en el <B>Dashboard</B>.</li>
            </ul>
            <GoButton onNavigate={onNavigate} view="calendar">Ir al Calendario</GoButton>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 text-center text-sm text-indigo-900" data-testid="help-contact">
        Cualquier duda con la configuración, escríbenos un email a{' '}
        <a href="mailto:reserva360.app@gmail.com" className="font-semibold text-indigo-700 underline">reserva360.app@gmail.com</a>{' '}
        y te ayudaremos.
      </div>
    </div>
  );
}
