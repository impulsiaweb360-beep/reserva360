// Contenido de las landings sectoriales.
// Regla: solo se describen funciones que Reserva360 tiene hoy. Nada de cifras, clientes ni testimonios inventados.

export const SECTORS = [
  {
    slug: 'software-reservas-fisioterapeutas',
    name: 'Fisioterapia',
    menuLabel: 'Fisioterapeutas',
    icon: 'Activity',
    keywords: ['software para fisioterapeutas', 'agenda online fisioterapia', 'programa de citas fisioterapia'],
    title: 'Software para fisioterapeutas: agenda y reservas online | Reserva360',
    description:
      'Agenda online para clínicas de fisioterapia: sesiones de distinta duración, horario por fisioterapeuta, recordatorios automáticos y reservas 24 h. Pruébalo gratis.',
    h1: 'Software de reservas para fisioterapeutas',
    lead:
      'Organiza las sesiones de tu centro de fisioterapia, deja que los pacientes reserven solos a cualquier hora y dedica tu tiempo a tratar, no a contestar mensajes.',
    problemsTitle: 'Lo que complica la agenda de un centro de fisioterapia',
    problems: [
      { t: 'Sesiones de duración diferente', d: 'Una valoración inicial no dura lo mismo que una sesión de seguimiento o una punción seca. Encajarlas a mano en la agenda deja huecos muertos o provoca retrasos.' },
      { t: 'Tratamientos de varias sesiones', d: 'El paciente necesita volver cada semana y cada cita se negocia por teléfono o WhatsApp, a menudo mientras estás con otro paciente en camilla.' },
      { t: 'Ausencias que no se avisan', d: 'Un hueco sin avisar es una hora de trabajo perdida. Sin recordatorios, depende de la memoria del paciente.' },
      { t: 'Varios fisioterapeutas con horarios distintos', d: 'Turnos de mañana y tarde, días libres y vacaciones hacen que saber quién está disponible sea un rompecabezas.' },
    ],
    helpTitle: 'Cómo te ayuda Reserva360 en tu consulta',
    help: [
      { t: 'Cada tratamiento con su duración', d: 'Crea servicios como "Primera valoración (60 min)" o "Sesión de seguimiento (45 min)". El sistema solo ofrece las horas en las que esa sesión cabe completa.' },
      { t: 'El paciente reserva su próxima sesión', d: 'Comparte tu enlace de reservas. El paciente elige tratamiento, fisioterapeuta, día y hora, sin llamarte.' },
      { t: 'Recordatorio 24 horas antes', d: 'Reserva360 envía la confirmación al reservar y un recordatorio el día anterior por email, y también por WhatsApp en el plan Pro.' },
      { t: 'Cambios sin llamadas', d: 'Cada email incluye un enlace para que el paciente cambie o cancele su cita. El hueco se libera al momento para otro paciente.' },
    ],
    featuresTitle: 'Funciones especialmente útiles en fisioterapia',
    features: [
      'Horario propio por fisioterapeuta, con pausa de mediodía',
      'Bloqueo de días por vacaciones o formación',
      'Ficha de cada paciente con su historial de citas y notas',
      'Calendario semanal para ver toda la clínica de un vistazo',
      'Control de cobros: marca las sesiones pagadas',
      'Estadísticas de reservas e ingresos del centro',
    ],
    setup: [
      'Crea tu cuenta y pon el nombre y el logo de tu clínica.',
      'Añade tus tratamientos con su duración y precio.',
      'Da de alta a los fisioterapeutas y ajusta el horario de cada uno.',
      'Comparte tu enlace de reservas en Google, Instagram o WhatsApp.',
    ],
    bookingFlow:
      'El paciente abre tu página de reservas desde el móvil, elige el tratamiento y, si quiere, el fisioterapeuta. Ve solo los huecos libres reales, deja su nombre, email y teléfono, y recibe la confirmación al momento. Si algo cambia, lo modifica él mismo desde el enlace del email.',
    teamTitle: 'Agenda por fisioterapeuta',
    team:
      'Cada profesional tiene su propio horario. Si alguien trabaja solo por las tardes o libra los viernes, el sistema no ofrecerá esas horas con él. Las vacaciones se bloquean en un momento y la agenda se ajusta sola.',
    faqs: [
      { q: '¿Puedo tener sesiones de distinta duración?', a: 'Sí. Cada servicio tiene su propia duración y precio, y el sistema calcula los huecos según lo que dure cada sesión.' },
      { q: '¿Sirve para guardar la historia clínica?', a: 'No. Reserva360 es una herramienta de agenda y reservas. Guarda los datos de contacto del paciente, su historial de citas y notas breves, pero no sustituye a un programa de historia clínica.' },
      { q: '¿Los pacientes necesitan instalar alguna aplicación?', a: 'No. Reservan desde el navegador del móvil o del ordenador con tu enlace, sin crear cuenta.' },
      { q: '¿Puedo cobrar la sesión por adelantado?', a: 'En el plan Business puedes conectar tu propia cuenta de Stripe y pedir el pago completo o una señal al reservar.' },
    ],
  },
  {
    slug: 'programa-citas-peluquerias',
    name: 'Peluquerías',
    menuLabel: 'Peluquerías',
    icon: 'Scissors',
    keywords: ['programa de citas para peluquerías', 'agenda peluquería online', 'reservas online peluquería'],
    title: 'Programa de citas para peluquerías con reservas online | Reserva360',
    description:
      'Agenda online para peluquerías: cada estilista con su horario, servicios con su duración, reservas 24 h y recordatorios por email y WhatsApp. Empieza gratis.',
    h1: 'Programa de citas para peluquerías',
    lead:
      'Tus clientas reservan corte, color o peinado a cualquier hora, cada estilista ve su agenda y tú dejas de apuntar citas en una libreta con las manos llenas de tinte.',
    problemsTitle: 'Por qué la agenda de una peluquería se desborda',
    problems: [
      { t: 'El teléfono suena mientras cortas', d: 'Contestar llamadas en mitad de un servicio interrumpe el trabajo y alarga los tiempos de espera.' },
      { t: 'Servicios que duran muy distinto', d: 'Un corte de caballero, unas mechas y un recogido de novia ocupan tiempos muy diferentes. Calcular a ojo provoca solapes o huecos vacíos.' },
      { t: 'Cada estilista tiene su clientela', d: 'Muchas clientas quieren siempre a la misma persona y necesitan ver cuándo tiene hueco esa estilista en concreto.' },
      { t: 'Los sábados se llenan y entre semana no', d: 'Sin una vista clara de la semana es difícil repartir la carga y ofrecer las horas libres.' },
    ],
    helpTitle: 'Cómo ayuda Reserva360 a tu salón',
    help: [
      { t: 'Reservas abiertas 24 horas', d: 'Tu salón tiene su propia página de reservas. La clienta elige servicio, estilista y hora incluso con el salón cerrado.' },
      { t: 'Duración real de cada servicio', d: 'Define cuánto dura cada servicio y el sistema bloquea exactamente ese tiempo, sin solapes con otras citas.' },
      { t: 'Citas por WhatsApp Business', d: 'En el plan Pro conectas el WhatsApp Business del salón: un asistente con menús y botones permite reservar, ver, cambiar o cancelar citas.' },
      { t: 'Menos olvidos', d: 'Confirmación al reservar y recordatorio el día anterior, por email y por WhatsApp en el plan Pro.' },
    ],
    featuresTitle: 'Funciones pensadas para peluquerías',
    features: [
      'Agenda independiente por estilista',
      'Servicios con color en el calendario para reconocerlos de un vistazo',
      'Fichas de clientas con historial de visitas',
      'Horario de sábado distinto al de entre semana',
      'Citas creadas desde el salón para quien llama o pasa por la puerta',
      'Resumen de ingresos y reservas del salón',
    ],
    setup: [
      'Regístrate y pon el nombre y el logo de tu peluquería.',
      'Crea tus servicios: corte, color, mechas, peinado… con su duración y precio.',
      'Añade a tu equipo y el horario de cada estilista.',
      'Pon tu enlace de reservas en la biografía de Instagram y en Google.',
    ],
    bookingFlow:
      'La clienta entra en tu enlace, elige "Corte y peinado", elige a su estilista y ve los huecos libres de esa persona. Reserva en menos de un minuto y recibe la confirmación con un enlace para cambiar la hora si lo necesita.',
    teamTitle: 'Tu equipo, organizado',
    team:
      'Cada estilista tiene su horario y sus días libres. Desde el calendario semanal ves quién está ocupado y quién tiene hueco, y puedes crear citas para cualquier miembro del equipo.',
    faqs: [
      { q: '¿Las clientas pueden elegir estilista?', a: 'Sí. Al reservar pueden elegir a la persona del equipo que prefieran y solo verán sus horas libres.' },
      { q: '¿Puedo seguir apuntando las citas que me piden por teléfono?', a: 'Sí. Desde el panel creas citas en segundos y el sistema comprueba que no se solapen con las reservas online.' },
      { q: '¿Qué pasa si una clienta quiere cambiar su cita?', a: 'Lo hace ella misma desde el enlace del email de confirmación, o desde WhatsApp si tienes el plan Pro.' },
      { q: '¿Cuántos estilistas puedo tener?', a: 'Depende del plan: 1 profesional en Free, hasta 3 en Pro y hasta 10 en Business.' },
    ],
  },
  {
    slug: 'software-reservas-centros-estetica',
    name: 'Centros de estética',
    menuLabel: 'Centros de estética',
    icon: 'Sparkles',
    keywords: ['agenda online para centros de estética', 'software centro de estética', 'reservas online estética'],
    title: 'Agenda online para centros de estética y reservas 24 h | Reserva360',
    description:
      'Software de reservas para centros de estética: tratamientos con su duración, cabinas y profesionales con horario propio, señal online y recordatorios automáticos.',
    h1: 'Software de reservas para centros de estética',
    lead:
      'Gestiona tratamientos faciales, depilación, manicura o masajes desde una sola agenda, y permite que tus clientas reserven el tratamiento que quieren sin esperar a que contestes.',
    problemsTitle: 'Los retos de organizar un centro de estética',
    problems: [
      { t: 'Muchos tratamientos, muchas duraciones', d: 'Una depilación de cejas dura minutos y un tratamiento facial completo más de una hora. Encajar todo a mano es lento y propenso a errores.' },
      { t: 'Bonos y tratamientos por sesiones', d: 'Las clientas vuelven cada pocas semanas y cada cita nueva se gestiona por mensaje.' },
      { t: 'Citas que se pierden sin avisar', d: 'Un tratamiento largo que no se presenta deja un hueco difícil de recolocar.' },
      { t: 'Profesionales con especialidades', d: 'No todas las esteticistas hacen todos los tratamientos ni trabajan los mismos días.' },
    ],
    helpTitle: 'Así te ayuda Reserva360',
    help: [
      { t: 'Catálogo de tratamientos claro', d: 'Tus clientas ven cada tratamiento con su duración y precio antes de reservar.' },
      { t: 'Señal al reservar', d: 'En el plan Business puedes pedir una señal o el pago completo por adelantado con tu propia cuenta de Stripe. El dinero llega directamente a ti.' },
      { t: 'Recordatorios automáticos', d: 'Confirmación al reservar y recordatorio el día anterior por email, y por WhatsApp en el plan Pro.' },
      { t: 'Autogestión de la clienta', d: 'La clienta puede cambiar o cancelar desde su enlace y el hueco queda libre al instante.' },
    ],
    featuresTitle: 'Funciones útiles para estética',
    features: [
      'Tratamientos con duración, precio y color en el calendario',
      'Horario propio por esteticista',
      'Fichas de clientas con historial y notas (por ejemplo, tipo de piel o alergias que te comenten)',
      'Bloqueo de vacaciones y días festivos',
      'Pago online o señal por tratamiento (plan Business)',
      'Estadísticas de ingresos por periodo',
    ],
    setup: [
      'Crea tu cuenta y personaliza tu página con el logo del centro.',
      'Añade tus tratamientos con duración, precio y, si quieres, señal online.',
      'Registra a tu equipo y el horario de cada profesional.',
      'Comparte el enlace de reservas en redes sociales y en tu ficha de Google.',
    ],
    bookingFlow:
      'La clienta elige el tratamiento, ve la duración y el precio, escoge día y hora entre los huecos libres y confirma. Si el tratamiento requiere señal, la paga con tarjeta en ese momento y la cita queda confirmada.',
    teamTitle: 'Profesionales y horarios',
    team:
      'Cada esteticista tiene su agenda. Si alguien libra los lunes o tiene vacaciones, sus horas desaparecen de la página de reservas automáticamente.',
    faqs: [
      { q: '¿Puedo pedir una señal para los tratamientos largos?', a: 'Sí, en el plan Business. Eliges por tratamiento si se paga en el centro, se puede pagar online, se pide una señal o se cobra completo al reservar.' },
      { q: '¿Las clientas ven los precios?', a: 'Sí, cada tratamiento muestra su duración y precio en la página de reservas.' },
      { q: '¿Puedo anotar información de cada clienta?', a: 'Sí, cada ficha tiene un campo de notas y el historial de sus citas.' },
      { q: '¿Necesito una web propia?', a: 'No. Reserva360 te da una página de reservas lista para compartir. Si ya tienes web, puedes enlazarla desde allí.' },
    ],
  },
  {
    slug: 'programa-gestion-veterinarias',
    name: 'Veterinarias',
    menuLabel: 'Veterinarios',
    icon: 'PawPrint',
    keywords: ['software de reservas para veterinarios', 'programa citas clínica veterinaria', 'agenda veterinaria online'],
    title: 'Programa de citas para clínicas veterinarias | Reserva360',
    description:
      'Agenda online para clínicas veterinarias: consultas, vacunas y peluquería canina con su duración, horario por veterinario y recordatorios automáticos a los dueños.',
    h1: 'Programa de citas para clínicas veterinarias',
    lead:
      'Ordena las consultas, vacunas y revisiones de tu clínica veterinaria y permite que los dueños pidan cita online sin saturar el teléfono de recepción.',
    problemsTitle: 'Lo que dificulta la agenda de una clínica veterinaria',
    problems: [
      { t: 'Recepción saturada', d: 'El mismo equipo que atiende a los animales tiene que contestar llamadas para dar citas de vacunas o revisiones.' },
      { t: 'Consultas de tipos muy distintos', d: 'Una vacuna, una revisión, una consulta de dermatología o una sesión de peluquería necesitan tiempos diferentes.' },
      { t: 'Dueños que olvidan la cita', d: 'Las revisiones se piden con semanas de antelación y es fácil que se olviden.' },
      { t: 'Varios veterinarios y turnos', d: 'Coordinar quién pasa consulta cada día, con guardias y vacaciones, complica dar citas.' },
    ],
    helpTitle: 'Cómo ayuda Reserva360 a tu clínica',
    help: [
      { t: 'Citas online para consultas programadas', d: 'Los dueños reservan vacunas, revisiones o peluquería desde tu enlace, a cualquier hora.' },
      { t: 'Tipos de consulta con su duración', d: 'Cada servicio ocupa el tiempo que necesita, sin solapes.' },
      { t: 'Recordatorio el día anterior', d: 'El dueño recibe la confirmación y un recordatorio 24 horas antes, por email o por WhatsApp en el plan Pro.' },
      { t: 'Agenda por veterinario', d: 'Cada profesional tiene su horario y el sistema solo ofrece sus horas disponibles.' },
    ],
    featuresTitle: 'Funciones útiles para veterinarias',
    features: [
      'Servicios separados: consulta, vacunación, revisión, peluquería canina…',
      'Ficha del dueño con historial de citas y notas (por ejemplo, el nombre de la mascota)',
      'Horario por veterinario y bloqueo de vacaciones',
      'Calendario semanal de toda la clínica',
      'Citas creadas desde recepción para llamadas y visitas',
      'Estadísticas de reservas e ingresos',
    ],
    setup: [
      'Crea la cuenta de tu clínica y añade el logo.',
      'Define tus servicios: consulta general, vacuna, revisión, peluquería…',
      'Da de alta a los veterinarios con su horario.',
      'Publica el enlace de reservas en tu web y en tu ficha de Google.',
    ],
    bookingFlow:
      'El dueño entra en tu enlace, elige el tipo de consulta y el veterinario si lo prefiere, selecciona un hueco libre y deja sus datos. En las notas puede indicar el nombre y la especie de su mascota. Recibe la confirmación al momento.',
    teamTitle: 'Veterinarios, turnos y vacaciones',
    team:
      'Cada veterinario tiene su horario semanal. Las vacaciones y días cerrados se bloquean una vez y desaparecen de la página de reservas.',
    faqs: [
      { q: '¿Sirve para urgencias?', a: 'Reserva360 está pensado para citas programadas. Las urgencias conviene seguir atendiéndolas por teléfono; puedes indicarlo en tu página.' },
      { q: '¿Tiene historia clínica veterinaria?', a: 'No. Es una herramienta de agenda y reservas: guarda los datos del dueño, sus citas y notas, pero no sustituye a un programa de gestión clínica veterinaria.' },
      { q: '¿Puedo registrar el nombre de la mascota?', a: 'Sí, en las notas de la cita o de la ficha del cliente.' },
      { q: '¿Recepción puede dar citas desde el panel?', a: 'Sí. Las citas creadas desde el panel y las reservas online comparten la misma agenda, así que no se solapan.' },
    ],
  },
  {
    slug: 'agenda-online-nutricionistas',
    name: 'Nutricionistas',
    menuLabel: 'Nutricionistas',
    icon: 'Apple',
    keywords: ['programa de citas para nutricionistas', 'agenda online nutricionista', 'reservas consulta nutrición'],
    title: 'Agenda online para nutricionistas y dietistas | Reserva360',
    description:
      'Agenda online para nutricionistas: primera consulta y revisiones con su duración, reservas 24 h, recordatorios y pago online opcional. Prueba Reserva360 gratis.',
    h1: 'Agenda online para nutricionistas',
    lead:
      'Tus pacientes reservan la primera consulta o su revisión cuando les viene bien, reciben recordatorios automáticos y tú tienes la semana organizada sin cruzar mensajes.',
    problemsTitle: 'Qué complica la agenda de un nutricionista',
    problems: [
      { t: 'Revisiones periódicas', d: 'El seguimiento cada dos o cuatro semanas genera muchas citas que hay que ir cuadrando una a una.' },
      { t: 'Trabajo en solitario', d: 'Muchos nutricionistas trabajan solos y no pueden contestar mensajes mientras pasan consulta.' },
      { t: 'Horarios partidos o en varios días', d: 'Pasar consulta solo algunas tardes o algunos días de la semana hace difícil explicar cuándo hay hueco.' },
      { t: 'Cancelaciones de última hora', d: 'Sin recordatorios, las revisiones se olvidan con facilidad.' },
    ],
    helpTitle: 'Cómo ayuda Reserva360 a tu consulta',
    help: [
      { t: 'Primera consulta y revisión, cada una con su duración', d: 'Por ejemplo 60 minutos para la primera visita y 30 para las revisiones. El sistema solo ofrece huecos donde caben.' },
      { t: 'Solo los días en los que pasas consulta', d: 'Configuras tu horario real y la página de reservas solo muestra esas horas.' },
      { t: 'Recordatorios automáticos', d: 'Confirmación y recordatorio 24 horas antes por email, y por WhatsApp en el plan Pro.' },
      { t: 'Cobro por adelantado opcional', d: 'En el plan Business puedes cobrar la consulta online con tu propia cuenta de Stripe.' },
    ],
    featuresTitle: 'Funciones útiles para nutricionistas',
    features: [
      'Página de reservas con tu nombre y logo',
      'Servicios con duración y precio propios',
      'Historial de citas de cada paciente y notas',
      'Bloqueo de vacaciones y días sin consulta',
      'El paciente cambia o cancela desde su enlace',
      'Resumen de ingresos y reservas',
    ],
    setup: [
      'Crea tu cuenta y personaliza tu página de reservas.',
      'Añade tus servicios: primera consulta, revisión, plan de seguimiento…',
      'Configura los días y horas en los que pasas consulta.',
      'Comparte tu enlace por WhatsApp, Instagram o en tu web.',
    ],
    bookingFlow:
      'El paciente elige "Revisión", ve los días en los que pasas consulta, escoge una hora y deja sus datos. Recibe la confirmación y, el día anterior, un recordatorio con un enlace por si necesita cambiarla.',
    teamTitle: 'Si trabajáis varios profesionales',
    team:
      'Si compartes consulta con otros nutricionistas o dietistas, cada uno tiene su propio horario y el paciente puede elegir con quién reservar.',
    faqs: [
      { q: '¿Funciona si solo paso consulta algunos días?', a: 'Sí. Configuras qué días y en qué horario trabajas, y la página de reservas solo ofrece esas horas.' },
      { q: '¿Puedo usarlo gratis?', a: 'Sí. Durante el lanzamiento el acceso es gratuito. Además existe un plan Free para 1 profesional y hasta 50 reservas al mes.' },
      { q: '¿Sirve para consultas online?', a: 'Sí. Puedes crear un servicio de "Consulta online" para reservarla igual. El enlace de videollamada lo envías tú por tu medio habitual.' },
      { q: '¿Los pacientes pueden cancelar solos?', a: 'Sí, desde el enlace del email de confirmación o desde WhatsApp en el plan Pro.' },
    ],
  },
  {
    slug: 'software-reservas-barberias',
    name: 'Barberías',
    menuLabel: 'Barberías',
    icon: 'Scissors',
    keywords: ['agenda online para barberías', 'app reservas barbería', 'programa citas barbería'],
    title: 'Agenda online para barberías: reservas 24 h | Reserva360',
    description:
      'Software de reservas para barberías: cada barbero con su agenda, cortes y arreglos de barba con su duración, reservas por web y WhatsApp y recordatorios automáticos.',
    h1: 'Agenda online para barberías',
    lead:
      'Tus clientes eligen barbero y hora en segundos, tú sigues con la máquina en la mano y la agenda se llena sola sin colas ni llamadas.',
    problemsTitle: 'El día a día de una barbería sin agenda online',
    problems: [
      { t: 'Citas cortas y muy seguidas', d: 'Cortes de 30 minutos uno tras otro dejan cero margen para contestar el móvil.' },
      { t: 'Cada cliente quiere a su barbero', d: 'Sin agenda por barbero, toca preguntar a todo el equipo cada vez que alguien pide hora.' },
      { t: 'Picos los viernes y sábados', d: 'Las horas más buscadas se llenan antes y conviene que el cliente vea qué queda libre.' },
      { t: 'Clientes que no aparecen', d: 'Un hueco perdido en hora punta es dinero que no vuelve.' },
    ],
    helpTitle: 'Cómo ayuda Reserva360 a tu barbería',
    help: [
      { t: 'Reserva en un minuto', d: 'El cliente elige "Corte + barba", su barbero y la hora libre desde el móvil.' },
      { t: 'WhatsApp Business de la barbería', d: 'En el plan Pro, tus clientes reservan, cambian o cancelan desde el WhatsApp Business de la barbería, con botones y sin escribir.' },
      { t: 'Recordatorios', d: 'Confirmación al reservar y recordatorio 24 horas antes, por email y por WhatsApp en el plan Pro.' },
      { t: 'Sin solapes', d: 'El sistema bloquea el tiempo exacto de cada servicio y evita reservas dobles con el mismo barbero.' },
    ],
    featuresTitle: 'Funciones útiles para barberías',
    features: [
      'Agenda independiente por barbero',
      'Servicios con duración y precio: corte, barba, afeitado clásico…',
      'Calendario semanal con colores por servicio',
      'Citas desde el panel para quien entra sin reserva',
      'Historial de visitas de cada cliente',
      'Ingresos y reservas de la semana y del mes',
    ],
    setup: [
      'Regístrate y sube el logo de tu barbería.',
      'Crea tus servicios con su duración y precio.',
      'Añade a tus barberos y su horario.',
      'Pon el enlace de reservas en Instagram, Google y en el cristal del local con un código QR.',
    ],
    bookingFlow:
      'El cliente abre tu enlace, elige servicio y barbero y ve las horas libres de ese barbero. Reserva con su nombre, email y teléfono, y le llega la confirmación al momento.',
    teamTitle: 'Barberos y turnos',
    team:
      'Cada barbero tiene su horario y sus días libres. Si alguien entra más tarde el sábado o libra el lunes, la página de reservas lo respeta automáticamente.',
    faqs: [
      { q: '¿El cliente puede elegir barbero?', a: 'Sí, y solo verá las horas libres de ese barbero.' },
      { q: '¿Puedo crear un código QR para el local?', a: 'Sí. Tu página de reservas es un enlace normal, así que puedes convertirlo en un código QR con cualquier generador gratuito.' },
      { q: '¿Puedo gestionar las citas con el WhatsApp Business de la barbería?', a: 'Sí, en el plan Pro. Conectas el número de WhatsApp Business de la barbería a través de YCloud y tus clientes reservan, consultan, cambian o cancelan sus citas desde ese mismo chat.' },
      { q: '¿Cuántos barberos admite?', a: '1 en el plan Free, hasta 3 en Pro y hasta 10 en Business.' },
    ],
  },
  {
    slug: 'agenda-online-entrenadores-personales',
    name: 'Entrenadores personales',
    menuLabel: 'Entrenadores personales',
    icon: 'Dumbbell',
    keywords: ['agenda online para entrenadores personales', 'reservas entrenamiento personal', 'software entrenador personal'],
    title: 'Agenda online para entrenadores personales | Reserva360',
    description:
      'Agenda de reservas para entrenadores personales y estudios de entrenamiento: sesiones con su duración, horario propio, recordatorios y pago por adelantado opcional.',
    h1: 'Agenda online para entrenadores personales',
    lead:
      'Deja que tus clientes reserven sus sesiones de entrenamiento en tus horas libres y olvídate de cuadrar la semana por WhatsApp entre serie y serie.',
    problemsTitle: 'Lo que complica la agenda de un entrenador personal',
    problems: [
      { t: 'Horarios muy repartidos', d: 'Entrenamientos a primera hora, a mediodía y por la tarde con huecos entre medias, difíciles de explicar por mensaje.' },
      { t: 'Coordinación constante por WhatsApp', d: 'Cada semana se repite la misma conversación para fijar las sesiones con cada cliente.' },
      { t: 'Sesiones que se cancelan tarde', d: 'Una cancelación de última hora deja un hueco que podría haber aprovechado otro cliente.' },
      { t: 'Cobros pendientes', d: 'Llevar la cuenta de qué sesiones están pagadas se hace a mano.' },
    ],
    helpTitle: 'Cómo te ayuda Reserva360',
    help: [
      { t: 'Tus horas libres siempre visibles', d: 'El cliente ve en tu enlace los huecos disponibles y reserva sin preguntarte.' },
      { t: 'Diferentes tipos de sesión', d: 'Entrenamiento individual, en pareja, valoración inicial… cada uno con su duración y precio.' },
      { t: 'Recordatorios automáticos', d: 'Confirmación y aviso el día anterior por email, y por WhatsApp en el plan Pro.' },
      { t: 'Control de pagos', d: 'Marca las sesiones pagadas o, en el plan Business, cobra por adelantado con tu Stripe.' },
    ],
    featuresTitle: 'Funciones útiles para entrenadores',
    features: [
      'Horario semanal con huecos y pausas',
      'Bloqueo de días por competiciones, formación o vacaciones',
      'Historial de sesiones de cada cliente',
      'El cliente cambia o cancela desde su enlace',
      'Estadísticas de sesiones e ingresos',
      'Si tienes un estudio, agenda por entrenador',
    ],
    setup: [
      'Crea tu cuenta y personaliza tu página de reservas.',
      'Añade tus tipos de sesión con duración y precio.',
      'Configura tu horario semanal real.',
      'Envía tu enlace a tus clientes o ponlo en tu perfil de Instagram.',
    ],
    bookingFlow:
      'Tu cliente abre el enlace, elige el tipo de sesión, ve tus horas libres y reserva. Le llega la confirmación y un recordatorio el día anterior con un enlace para cambiarla si le surge algo.',
    teamTitle: 'Si tienes un estudio con varios entrenadores',
    team:
      'Cada entrenador tiene su propio horario y su agenda. El cliente puede elegir con quién entrenar y tú ves la ocupación de todo el estudio en el calendario semanal.',
    faqs: [
      { q: '¿Sirve para clases en grupo con aforo?', a: 'Por ahora Reserva360 gestiona citas individuales: cada reserva ocupa el hueco del profesional. Las clases con aforo no están disponibles.' },
      { q: '¿Puedo entrenar en distintos sitios?', a: 'Puedes indicar el lugar en el nombre del servicio o en las notas de la cita.' },
      { q: '¿Puedo cobrar por adelantado?', a: 'Sí, en el plan Business, con tu propia cuenta de Stripe. El dinero llega directamente a ti.' },
      { q: '¿Es útil si trabajo solo?', a: 'Sí. El plan Free cubre 1 profesional y hasta 50 reservas al mes.' },
    ],
  },
  {
    slug: 'software-gestion-clinicas',
    name: 'Clínicas y consultas',
    menuLabel: 'Clínicas y consultas',
    icon: 'Stethoscope',
    keywords: ['software para clínicas', 'programa de gestión de citas clínica', 'agenda online consulta médica'],
    title: 'Software de citas para clínicas y consultas | Reserva360',
    description:
      'Programa de gestión de citas para clínicas y consultas privadas: agenda por profesional, reservas online 24 h, recordatorios automáticos y estadísticas del centro.',
    h1: 'Software de gestión de citas para clínicas',
    lead:
      'Coordina las agendas de todos los profesionales de tu clínica, ofrece cita online a tus pacientes y reduce las llamadas a recepción.',
    problemsTitle: 'Los problemas habituales en la agenda de una clínica',
    problems: [
      { t: 'Muchos profesionales, una sola recepción', d: 'Recepción tiene que conocer los horarios de todos para dar cada cita.' },
      { t: 'Especialidades con tiempos distintos', d: 'Una primera visita, una revisión y una prueba ocupan tiempos diferentes en la agenda.' },
      { t: 'Pacientes que no acuden', d: 'Sin recordatorios, las citas reservadas con semanas de antelación se olvidan.' },
      { t: 'Poca visibilidad de la actividad', d: 'Saber cuántas citas e ingresos tiene el centro exige sumar a mano.' },
    ],
    helpTitle: 'Cómo ayuda Reserva360 a tu clínica',
    help: [
      { t: 'Agenda por profesional', d: 'Cada especialista tiene su horario y la página de reservas solo ofrece sus huecos reales.' },
      { t: 'Cita online 24 horas', d: 'Los pacientes reservan desde el móvil sin llamar a recepción.' },
      { t: 'Recordatorios y autogestión', d: 'Confirmación, recordatorio 24 horas antes y enlace para cambiar o cancelar la cita.' },
      { t: 'Estadísticas del centro', d: 'Reservas e ingresos por periodo en el panel de administración.' },
    ],
    featuresTitle: 'Funciones útiles para clínicas',
    features: [
      'Hasta 10 profesionales en el plan Business',
      'Agenda semanal de todo el equipo',
      'Fichas de pacientes con historial de citas y notas',
      'Bloqueo de vacaciones y festivos',
      'Cobro online o señal por servicio (plan Business)',
      'Citas creadas desde recepción y reservas online en la misma agenda',
    ],
    setup: [
      'Crea la cuenta de la clínica y añade el logo.',
      'Da de alta los servicios de cada especialidad con su duración.',
      'Registra a los profesionales y su horario.',
      'Publica el enlace de cita online en tu web y en Google.',
    ],
    bookingFlow:
      'El paciente elige el servicio y el profesional, ve los huecos libres y reserva con su nombre, email y teléfono. Recibe la confirmación al instante y un recordatorio el día anterior.',
    teamTitle: 'Coordinación del equipo',
    team:
      'Cada profesional tiene su horario, con pausas y días libres. En el calendario semanal puedes ver la agenda de todo el equipo o filtrar por profesional.',
    faqs: [
      { q: '¿Incluye historia clínica?', a: 'No. Reserva360 se centra en la agenda, las reservas y los clientes. Guarda los datos de contacto, el historial de citas y notas breves, pero no es un programa de historia clínica.' },
      { q: '¿Puedo ver la agenda de un solo profesional?', a: 'Sí. El calendario semanal permite ver a todo el equipo o filtrar por profesional.' },
      { q: '¿Cuántos profesionales admite?', a: 'Hasta 3 en el plan Pro y hasta 10 en el plan Business.' },
      { q: '¿Dónde se guardan los datos?', a: 'En una base de datos con acceso separado por negocio: cada clínica solo ve sus propios datos.' },
    ],
  },
];

export const getSector = (slug) => SECTORS.find((s) => s.slug === slug);
