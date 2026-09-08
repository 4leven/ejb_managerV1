# EJB MANAGER · Documentación sencilla

Versión actual: **V. 0.2.25**

## ¿Qué es?

EJB MANAGER es una aplicación web interna para administrar iniciativas, objetivos, equipos, mensajes, calendarios, requerimientos, documentos, aprobaciones e informes BI. Funciona en una computadora central y puede abrirse desde otros equipos conectados a la misma red Wi‑Fi.

## Lenguajes y tecnologías

- **HTML5:** contiene el punto inicial que carga la aplicación en el navegador.
- **CSS3:** controla colores, modo oscuro, ventanas emergentes, adaptabilidad móvil y animaciones.
- **TypeScript:** lenguaje principal del frontend y backend; añade validación de tipos a JavaScript.
- **React:** construye las pantallas y componentes interactivos del frontend.
- **Express:** publica la API del backend y recibe las operaciones de la web.
- **Prisma:** conecta el backend con PostgreSQL y define las tablas y relaciones.
- **PostgreSQL:** almacena permanentemente usuarios, iniciativas, progresos, mensajes, eventos y demás registros.

Los nombres propios de las librerías y palabras reservadas como `import`, `export`, `const`, `return` o `useState` permanecen en inglés porque forman parte del lenguaje. Los nombres del negocio, textos, documentación y reglas están escritos en español.

## Arquitectura: cuatro capas

1. **Presentación — frontend:** pantallas, botones, formularios, gráficos, menús y ventanas emergentes.
2. **Comunicación — API REST:** solicitudes HTTP entre React y Express.
3. **Negocio — backend:** permisos, validaciones, estados, cálculos, códigos automáticos y reglas de aprobación.
4. **Datos — PostgreSQL:** almacenamiento persistente mediante Prisma.

Flujo general:

`Navegador → React → API Express → servicios → Prisma → PostgreSQL`

## Estructura principal

```text
Proyecto Innovation Hub/
├── frontend/
│   ├── index.html              Punto de entrada utilizado por Vite
│   ├── public/                 Logos e isotipos
│   └── src/
│       ├── api/                Comunicación con el backend
│       ├── components/         Módulos visuales reutilizables
│       ├── utils/              Diálogos y funciones auxiliares
│       ├── App.tsx             Navegación y composición principal
│       └── main.tsx            Inicio de React
├── backend/
│   ├── prisma/schema.prisma    Modelo de la base de datos
│   └── src/
│       ├── controllers/        Reciben y validan solicitudes
│       ├── services/           Reglas de negocio
│       ├── routes/             Rutas de la API
│       ├── middlewares/        Sesión, errores y seguridad
│       └── server.ts           Inicio del servidor
├── docker-compose.yml          PostgreSQL local
└── README.md                   Instrucciones técnicas
```

## Archivo index.html

El archivo utilizado es `frontend/index.html`. No contiene toda la página porque React genera la interfaz dentro del elemento `<div id="root"></div>`. Vite se encarga de cargar `frontend/src/main.tsx`. Esta es la estructura correcta para una aplicación React moderna y no debe reemplazarse por un HTML estático.

## Uso dentro de la red Wi‑Fi

Mientras esta configuración esté habilitada:

- En esta computadora: `http://127.0.0.1:5173`
- En otros equipos del mismo Wi‑Fi: `http://192.168.1.200:5173`
- API interna: puerto `4000` de la misma computadora.

La computadora que aloja EJB MANAGER debe permanecer encendida, conectada al Wi‑Fi y con frontend, backend y PostgreSQL ejecutándose. La dirección `192.168.1.200` puede cambiar si el router asigna otra IP.

Si Windows bloquea el acceso, se deben autorizar los puertos TCP privados `5173` y `4000` desde Firewall de Windows ejecutando la configuración como administrador.

## Datos y seguridad

- Los datos no se guardan en el HTML ni en los equipos de los compañeros.
- Todos los registros permanecen en PostgreSQL en la computadora principal.
- Las contraseñas se almacenan cifradas mediante hash.
- El acceso por Wi‑Fi es privado para la red local; no publica la aplicación en Internet.
- Al deshabilitar el modo de red local, los servicios volverán a escuchar únicamente desde esta computadora.

## Control de versiones

La versión aparece debajo de “Cerrar sesión” en la columna izquierda. Se incrementará con las siguientes entregas: `V. 0.1.8`, `V. 0.1.9`, etc.
