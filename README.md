# Facturación electrónica Ecuador — aplicación web (client-factura-facil)

Next.js (App Router) con la que una empresa se da de alta como emisor, carga su certificado, mantiene clientes y productos, emite facturas y sigue su estado ante el SRI.

La API, el contrato, la infraestructura, la documentación y las pruebas con navegador están en [backend-emite-facil](https://github.com/DevNation593/backend-emite-facil). Ramas: `dev` (integración: cada cambio llega por pull request), `qa` y `main`.

## Cómo está hecha

- **El navegador nunca ve los tokens.** El servidor de Next hace el inicio de sesión OIDC (código de autorización con PKCE) y guarda la sesión cifrada (AES-256-GCM) en cookies `httpOnly`. Toda llamada a la API pasa por un único proxy, `/api/backend/*`, que añade el `Authorization` y la empresa activa en el servidor.
- **Cada pestaña trabaja con su empresa.** La empresa activa se recuerda en una cookie, que es de todo el navegador; por eso cada petición nombra además la empresa de la pestaña que la hace, y esa es la que vale. Elegir otra empresa en otra pestaña no cambia a dónde escribe esta.
- **El proxy decide a dónde se puede ir.** Solo reenvía a `${API_BASE_URL}/api/v1/…`, con los métodos que la API usa, sin cabeceras del navegador salvo las necesarias. Una petición que cambia datos debe venir del mismo origen y llevar la marca `X-Requested-With: einvoice-web`; si no, `403`.
- **Tipos generados del contrato.** `src/api/schema.ts` sale de `contracts/openapi.yaml`, copia del contrato de la API ([backend-emite-facil](https://github.com/DevNation593/backend-emite-facil/blob/dev/contracts/openapi.yaml)). No se edita a mano: `npm run api:generate` lo regenera y una prueba falla si está desactualizado. Cuando la API cambia su contrato, se copia aquí y se regenera; el CI falla si la copia no es la de la API de la misma rama.
- **Importes como cadenas.** La aritmética de la vista previa de la factura usa enteros (`BigInt`), nunca `number`. El total que vale es el que devuelve la API.
- **Política de contenido por respuesta.** `src/proxy.ts` da a cada página un valor de un solo uso y solo se ejecutan los scripts que lo llevan; por eso todas las páginas se generan al pedirlas.
- **Registro de eventos.** `src/server/log.ts` escribe una línea JSON por fallo que un operador necesita ver, sin tokens ni datos de la petición.
- **Borradores en el navegador.** La API no tiene borradores: se guardan en `localStorage`, por empresa. No se ven desde otro equipo. Cada borrador lleva su clave de idempotencia, así que emitirlo dos veces produce una sola factura.

## Estructura

| Ruta | Qué hay |
|---|---|
| `src/server/` | Configuración, sesión cifrada, cliente OIDC y reglas del proxy. Solo código de servidor. |
| `src/app/auth/`, `src/app/api/` | Inicio y cierre de sesión, estado de la sesión y el proxy de la API. |
| `src/app/(app)/` | Las pantallas, que exigen sesión: comprobantes, facturas, clientes, productos, configuración, equipo e invitación. |
| `src/api/` | Cliente tipado de la API y traducción de sus errores a mensajes para el usuario. |
| `src/lib/` | Aritmética decimal, vista previa de la factura, borradores, estados del comprobante, empresa activa. |
| `src/components/` | Marco de la aplicación y piezas de formulario. |
| `src/test/` | API simulada y utilidades para las pruebas de pantallas. |

## Variables de entorno

Copiar `.env.example` a `.env.local` y completar. Ninguna llega al navegador.

| Variable | Para qué |
|---|---|
| `API_BASE_URL` | Dirección de la API de Spring, sin `/api/v1`. |
| `API_TIMEOUT_MS` | Opcional: cuánto se espera a la API antes de responder `504` (30000). |
| `APP_BASE_URL` | Dirección pública de esta aplicación; de ella sale la redirección del inicio de sesión. Con `https`, las cookies llevan `Secure`; fuera de `localhost` es obligatorio. |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID` | Proveedor de identidad y cliente. El emisor debe ser el mismo que valida la API. Solo se admite `http` en `localhost`. |
| `OIDC_CLIENT_SECRET`, `OIDC_AUDIENCE`, `OIDC_SCOPE` | Opcionales: cliente confidencial, audiencia que algunos proveedores exigen pedir, y ámbitos (por defecto `openid profile email`; el correo hace falta para aceptar invitaciones). |
| `SESSION_SECRET` | Al menos 32 caracteres aleatorios. Cifra las cookies de sesión: cambiarlo cierra todas las sesiones. |

## Comandos

```bash
npm ci
```

```bash
npm run dev
```

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Para arrancar todo en local (infraestructura, proveedor de identidad de desarrollo, API y esta aplicación), ver [docs/DEVELOPMENT.md](https://github.com/DevNation593/backend-emite-facil/blob/dev/docs/DEVELOPMENT.md) en el repositorio de la API.

## Límites conocidos

- **Las pruebas con navegador viven en el repositorio de la API**, en [`e2e/`](https://github.com/DevNation593/backend-emite-facil/blob/dev/e2e/README.md): recorren la aplicación completa (esta compilación de producción y el jar de la API) contra un SRI simulado. Aquí las pantallas se prueban como componentes contra una API simulada, y el código de servidor (inicio de sesión, renovación, cierre, proxy) contra un proveedor de identidad de prueba que corre en la propia máquina.
- **Solo se ha visto en Chromium**, en escritorio y en el ancho de un teléfono (375 px), donde ninguna pantalla principal se desplaza de lado; las tablas anchas se desplazan dentro de su caja. Lo que la revisión de las pantallas encontró y cómo quedó está en el [doc 15](https://github.com/DevNation593/backend-emite-facil/blob/dev/docs/15-produccion.md).
- **Una sola forma de pago por factura** en el editor. Los productos, como los clientes, se buscan: la lista de cada línea muestra los 20 primeros resultados.
- **"Integraciones"** (propietario y administradores) registra las direcciones a las que avisar de lo que pasa con los comprobantes, muestra su secreto una sola vez y enseña los 20 avisos más recientes de cada una, sin paginar los anteriores. Si la instalación tiene los avisos apagados, registrar una dirección responde con un mensaje que lo dice.
- **Las invitaciones no se envían:** "Equipo" muestra el enlace una vez y lo comparte quien invita. Para aceptarlo hay que iniciar sesión con el correo invitado, y el proveedor de identidad debe informar de ese correo.
- **Los borradores quedan en el navegador al cerrar sesión.** En un equipo compartido, otra persona de la misma empresa que use el mismo perfil del navegador los vería.
- **Una sola instancia a efectos de renovación de sesión.** Las peticiones simultáneas comparten una renovación del token dentro de un mismo proceso; con varias instancias y un proveedor que rota el token de refresco, hace falta afinidad de sesión o un almacén compartido.
- **Solo español**, sin internacionalización.
