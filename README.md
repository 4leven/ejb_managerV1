# EJB MANAGER

Sistema full-stack para registrar usuarios por área y cargo, evaluar iniciativas y dar seguimiento al portafolio de innovación.

Incluye mensajería interna con documentos y stickers, modo oscuro, contraste automático, cronograma tipo Gantt, alertas de retraso, historial diario de progreso, aprobaciones por Gerente de área y perfiles editables con foto opcional.

## Inicio local

1. Copia `backend/.env.example` como `backend/.env`.
2. Ejecuta `docker compose up -d`.
3. Instala dependencias con `pnpm install`.
4. Ejecuta `pnpm --dir backend prisma:generate` y `pnpm --dir backend prisma:migrate`.
5. Inicia frontend y backend con `pnpm dev`.

Frontend: `http://localhost:5173` · API: `http://localhost:4000/api`

## Dónde se guardan los datos

Los datos se guardan en PostgreSQL 16, en la base `ejb_innovation_hub` y el esquema `public`:

- `usuarios`: nombres, apellidos, correo, contraseña cifrada, área, cargo y rol.
- `areas`: catálogo de Marketing, Consultoría Contable, Consultoría Planilla, Ventas, Gerencia, Administración e Innovación y Producto.
- `iniciativas`: propuestas, evaluación, estado, avance y responsable.
- `progresos`: historial de porcentajes y comentarios de cada proyecto.
- `mensajes`: conversaciones privadas, estado de lectura, stickers y documentos adjuntos codificados en base64. Cada documento está limitado a 2 MB desde la interfaz (3 MB en la validación de la API).
- `solicitudes_cambio`: edición o eliminación pendiente de aprobación del Gerente del área.
- `objetivos_negocio`: objetivos estratégicos asociados a iniciativas.

Las contraseñas nunca se guardan como texto: se protegen mediante un hash bcrypt. El navegador conserva únicamente un token temporal de sesión en `localStorage`.

Las áreas son datos de catálogo necesarios para el registro. Los registros creados desde la aplicación se conservan en PostgreSQL aunque se cierre o recargue el navegador.

## Reglas implementadas

- Score: `(impacto / peso_esfuerzo) * 10`.
- Pesos: Bajo 1, Medio 2, Alto 4.
- Flujo: Pendiente → En evaluación → Priorizado → En desarrollo.
- Una iniciativa requiere responsable antes de pasar a Priorizado.
- Código automático con formato `INV-XXX`.
- Cada usuario puede guardar un color principal personalizado para su portal.
- El usuario Santiago Villanueva tiene acceso global de superadministrador para administrar iniciativas y solicitudes de cualquier área.
- Todos los usuarios pueden cambiar su área desde el perfil. Únicamente la cuenta superadministradora de Santiago puede modificar su propio rol, incluyendo Gerente.
- La campana de notificaciones y el menú de usuario se abren y cierran desde el mismo control, sin recargar la página.
- Cada iniciativa puede guardar en PostgreSQL un emoji o iniciales y un color de icono personalizados.
- El dashboard incluye indicadores de avance, distribución por estado y rendimiento por área calculados con datos reales.
- Los filtros de proyectos combinan área, estado y esfuerzo, y permiten ordenar por score, avance o fecha.
- Santiago puede ascender o descender los cargos del equipo desde la vista Equipo.
- El menú lateral admite desplazamiento vertical y puede contraerse para ampliar el espacio de trabajo.
- El Centro de ayuda incluye explicaciones desplegables y las tarjetas del resumen responden al cursor.
- Calendario persistente con horario inicial/final, área, responsable, proyecto, prioridad, estado, color e icono.
- Notificaciones limitadas al área o proyectos asignados; Santiago conserva la vista global.
- Informes BI con indicadores, rendimiento por área, trazabilidad, Gantt ejecutivo y matriz detallada.
- Requerimientos administrativos editables para materiales, suministros y recursos internos.
- Flujos de Áreas permite cargar y previsualizar documentos PDF de hasta 3 MB.
- Santiago puede eliminar perfiles desde Equipo; el sistema protege su propia cuenta administradora.
- El perfil permite cambiar la contraseña verificando primero la contraseña actual.
- La navegación móvil ofrece un menú lateral desplegable y módulos adaptados a pantallas pequeñas.
- El menú lateral tiene controles propios para reducir o ampliar su escala sin modificar el zoom del navegador.
- Los eventos solo pueden ser editados o eliminados por la persona que los creó.
- Requerimientos identifica claramente al solicitante y su área; Flujos permite publicar y previsualizar PDF.
- El restablecimiento de contraseña funciona localmente; para enviar enlaces por correo en producción se deben configurar credenciales SMTP corporativas.
- El calendario es corporativo: todas las cuentas autenticadas pueden consultar eventos anteriores y futuros de todas las áreas. Solo el creador puede modificarlos o eliminarlos.

## Acceso HTTPS en la red local

La interfaz se sirve mediante HTTPS y canaliza `/api` internamente al backend. En esta PC se accede desde `https://localhost:5173`; desde otros equipos de la misma red, mediante `https://192.168.1.200:5173` mientras esa sea la IP local del servidor.

El certificado es local y autofirmado. La primera vez, cada equipo debe aceptar o instalar el certificado de EJB MANAGER como certificado de confianza. Si cambia la IP del servidor, se debe generar un certificado nuevo que incluya la nueva dirección.

## Mensajería avanzada y Huddles

EJB Chat permite responder mensajes directos, reaccionar con varios emojis, reenviar a varias personas, programar envíos, buscar dentro del historial y abrir fichas rápidas mediante menciones o códigos `INV-XXX`. Los grupos y canales conservan sus mensajes en `RegistroPortal` y también admiten respuestas y reacciones múltiples.

Los Huddles utilizan LiveKit mediante `LIVEKIT_URL`, `LIVEKIT_API_KEY` y `LIVEKIT_API_SECRET`:

- Desarrollo local: copia los valores de `backend/.env.example` y ejecuta `docker compose up -d livekit`. LiveKit quedará disponible en `ws://localhost:7880`.
- LiveKit Cloud: crea un proyecto en `cloud.livekit.io` y reemplaza las tres variables con la URL, API key y secret proporcionados. No se necesita cambiar código.

Para probar una llamada, abre dos navegadores con usuarios diferentes, entra en la misma conversación y pulsa teléfono o cámara. La segunda sesión verá “Huddle en curso — Unirse”. El panel flotante permite usar micrófono, cámara, compartir pantalla, minimizar y colgar.
