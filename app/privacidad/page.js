import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import { pageMetadata } from '@/lib/site';
import { getLegalInfo, DEFAULT_LEGAL, captureAdminClient } from '@/lib/crm/capture';
import { CONSENT_VERSION } from '@/lib/crm/consent';
import { turnstileConfigured } from '@/lib/crm/turnstile'; // la mención a Cloudflare solo aparece si se activa

export const revalidate = 600;
export const metadata = pageMetadata({
  title: 'Política de privacidad | Reserva360',
  description: 'Cómo trata Reserva360 los datos personales de quienes solicitan información, demostraciones o usan la plataforma.',
  path: '/privacidad',
});

async function legal() {
  try { return await getLegalInfo(captureAdminClient()); } catch { return DEFAULT_LEGAL; }
}

export default async function PrivacidadPage() {
  const L = await legal();
  const H2 = 'mt-10 text-2xl font-bold';
  const P = 'mt-3 text-slate-700';
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <MarketingHeader />
      <main id="contenido" className="container mx-auto max-w-3xl px-4 py-12 md:px-6">
        <h1 className="text-4xl font-extrabold tracking-tight">Política de privacidad</h1>
        <p className="mt-2 text-sm text-slate-500">Versión {CONSENT_VERSION}</p>

        <h2 className={H2}>1. Responsable del tratamiento</h2>
        <ul className="mt-3 space-y-1 text-slate-700" data-testid="privacy-controller">
          <li><strong>Titular:</strong> {L.owner}</li>
          {L.nif && <li><strong>NIF/CIF:</strong> {L.nif}</li>}
          {L.address && <li><strong>Dirección:</strong> {L.address}</li>}
          <li><strong>Email de contacto y privacidad:</strong> <a className="text-indigo-600 hover:underline" href={`mailto:${L.email}`}>{L.email}</a></li>
        </ul>

        <h2 className={H2}>2. Qué datos tratamos</h2>
        <p className={P}>Si nos pides información o una demostración (en nuestra web o en formularios de Facebook e Instagram), tratamos los datos que nos facilitas: nombre y apellidos, nombre y tipo de negocio, email, teléfono, ciudad, provincia, número aproximado de empleados, cómo gestionas hoy tus reservas y lo que nos cuentas sobre tus necesidades. También guardamos la fecha, el canal por el que llega la solicitud y tus preferencias de comunicación.</p>

        <h2 className={H2}>3. Para qué y con qué base jurídica</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-700">
          <li><strong>Atender tu solicitud</strong> (responderte, darte información o preparar la demo): aplicación de medidas precontractuales a petición tuya (art. 6.1.b RGPD).</li>
          <li><strong>Enviarte comunicaciones comerciales por email o WhatsApp</strong>: solo si lo aceptas marcando la casilla correspondiente (art. 6.1.a RGPD y art. 21 LSSI). Es opcional y no condiciona tu solicitud. Puedes retirarlo cuando quieras.</li>
          <li><strong>Proteger el formulario frente a abusos</strong> (spam y envíos automatizados): interés legítimo (art. 6.1.f RGPD). Guardamos la IP de forma cifrada (hash), no en claro.</li>
        </ul>

        <h2 className={H2}>4. Cuánto tiempo guardamos los datos</h2>
        <p className={P}>Mientras gestionamos tu solicitud y, después, durante un máximo de 24 meses desde el último contacto si no llegas a ser cliente, salvo que antes pidas su supresión. Si te opones a las comunicaciones comerciales, conservamos lo mínimo imprescindible para respetar tu decisión (lista de no contactar).</p>

        <h2 className={H2}>5. Destinatarios y proveedores</h2>
        <p className={P}>No vendemos ni cedemos tus datos a terceros, salvo obligación legal. Usamos proveedores que tratan datos por nuestra cuenta con las garantías del RGPD: alojamiento y base de datos (Supabase, Vercel){turnstileConfigured() ? ', protección antispam (Cloudflare Turnstile, que analiza señales técnicas del navegador para detectar bots)' : ''} y, si nos contactas mediante anuncios, Meta Platforms (Facebook e Instagram) como plataforma del formulario. Algunos pueden implicar transferencias internacionales amparadas en el Marco de Privacidad de Datos UE-EE. UU. o cláusulas contractuales tipo.</p>

        <h2 className={H2}>6. Tus derechos</h2>
        <p className={P}>Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad, y retirar tu consentimiento, escribiendo a <a className="text-indigo-600 hover:underline" href={`mailto:${L.email}`}>{L.email}</a>. Para eliminar tus datos, consulta el <a className="text-indigo-600 hover:underline" href="#eliminacion-datos">apartado 8</a>. Si consideras que no hemos atendido bien tu solicitud, puedes reclamar ante la Agencia Española de Protección de Datos (<a className="text-indigo-600 hover:underline" href="https://www.aepd.es" rel="noopener noreferrer" target="_blank">aepd.es</a>).</p>

        <h2 className={H2}>7. Datos de los clientes de los negocios</h2>
        <p className={P}>Cuando un negocio usa Reserva360 para gestionar las citas de sus clientes, ese negocio es el responsable de esos datos y Reserva360 actúa como encargado del tratamiento, siguiendo sus instrucciones.</p>

        <h2 id="eliminacion-datos" className={`${H2} scroll-mt-24`} data-testid="privacy-data-deletion">8. Eliminación de tus datos</h2>
        <p className={P}>Puedes pedirnos en cualquier momento que eliminemos tus datos personales. Es gratis y no tienes que justificarlo.</p>

        <h3 className="mt-6 text-lg font-semibold">Cómo solicitarlo</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-6 text-slate-700">
          <li>Escríbenos a <a className="text-indigo-600 hover:underline" href={`mailto:${L.email}?subject=${encodeURIComponent('Eliminación de datos')}`}>{L.email}</a> con el asunto <strong>«Eliminación de datos»</strong>.</li>
          <li>Envíalo desde el email con el que nos contactaste o indícanos el email o teléfono que usaste y por dónde nos llegó tu solicitud (web, Facebook, Instagram o tu cuenta de Reserva360). Así podemos localizar tus datos sin pedirte información adicional.</li>
          <li>Si tenemos dudas razonables sobre tu identidad, podremos pedirte que la confirmes antes de eliminar nada, para proteger tus datos frente a solicitudes de terceros.</li>
        </ol>

        <h3 className="mt-6 text-lg font-semibold">Si nos contactaste desde Facebook o Instagram</h3>
        <p className={P}>Los datos de los formularios de Facebook e Instagram se eliminan igual, escribiéndonos al email anterior. Además, puedes revisar o quitar el acceso de Reserva360 desde Facebook en <strong>Configuración y privacidad → Configuración → Integraciones comerciales</strong>. Quitar el acceso en Facebook no borra por sí solo los datos que ya recibimos: para eso, envíanos la solicitud.</p>

        <h3 className="mt-6 text-lg font-semibold">Si tienes una cuenta de negocio en Reserva360</h3>
        <p className={P}>Escríbenos desde el email de tu cuenta. Eliminaremos tu cuenta, los datos de tu negocio y la información asociada. Si tienes una suscripción de pago activa, la cancelaremos. Te recomendamos exportar antes la información que quieras conservar.</p>

        <h3 className="mt-6 text-lg font-semibold">Plazo y confirmación</h3>
        <p className={P}>Atenderemos tu solicitud en un máximo de <strong>un mes</strong> desde que la recibamos (art. 12.3 RGPD) y te confirmaremos por email cuando esté hecha.</p>

        <h3 className="mt-6 text-lg font-semibold">Qué conservamos y por qué</h3>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-700">
          <li><strong>Lista de no contactar:</strong> para no volver a contactarte ni a incorporar tus datos por error, guardamos únicamente una huella cifrada (no reversible) de tu email y teléfono, sin tu nombre ni ningún otro dato.</li>
          <li><strong>Obligaciones legales:</strong> si has sido cliente, las facturas y los datos de facturación se conservan bloqueados durante los plazos que exige la ley (normativa mercantil y tributaria) y solo se usan para cumplir esas obligaciones.</li>
          <li><strong>Copias de seguridad:</strong> los datos pueden permanecer en copias de seguridad cifradas hasta su rotación automática, sin usarse para ningún otro fin.</li>
        </ul>

        <h3 className="mt-6 text-lg font-semibold">Si eres cliente de un negocio que usa Reserva360</h3>
        <p className={P}>Si solo has reservado citas con un negocio que usa Reserva360, ese negocio es el responsable de tus datos (apartado 7). Puedes pedirle la eliminación directamente; si nos escribes a nosotros, le haremos llegar tu solicitud para que la atienda.</p>

        <p className="mt-10 text-sm text-slate-500">Consulta también nuestra <a href="/cookies" className="text-indigo-600 hover:underline">política de cookies</a>.</p>
      </main>
      <MarketingFooter />
    </div>
  );
}
