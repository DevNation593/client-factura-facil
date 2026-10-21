# Facturación electrónica Ecuador — aplicación web (client-factura-facil)

Next.js (App Router) con la que una empresa se da de alta como emisor, carga su certificado, mantiene clientes y productos, emite facturas y sigue su estado ante el SRI.

La API, el contrato, la infraestructura, la documentación y las pruebas con navegador están en [api-emite-facil](https://github.com/DevNation593/api-emite-facil). Ramas: `dev` (integración: cada cambio llega por pull request), `qa` y `main`.

## Cómo está hecha

- **El navegador nunca ve los tokens.** Las cuentas las lleva la API (correo y contraseña; no hay proveedor de identidad). Los formularios de ingreso, registro y recuperación de contraseña van a rutas del servidor de Next (`/auth/*`), que llaman a la API y guardan la sesión cifrada (AES-256-GCM) en cookies `httpOnly`. Toda llamada a la API pasa por un único proxy, `/api/backend/*`, que añade el `Authorization` y la empresa activa en el servidor; de `/auth` solo deja pasar `me`, `password` y `email-verification/resend`.
- **Los enlaces de los correos llevan el código en el fragmento** (`#token=…`), que el navegador no envía a ningún servidor ni aparece en registros; la página lo lee una vez y lo quita de la barra de direcciones.
- **Cada pestaña trabaja con su empresa.** La empresa activa se recuerda en una cookie, que es de todo el navegador; por eso cada petición nombra además la empresa de la pestaña que la hace, y esa es la que vale. Elegir otra empresa en otra pestaña no cambia a dónde escribe esta.
- **El proxy decide a dónde se puede ir.** Solo reenvía a `${API_BASE_URL}/api/v1/…`, con los métodos que la API usa, sin cabeceras del navegador salvo las necesarias. Una petición que cambia datos debe venir del mismo origen y llevar la marca `X-Requested-With: einvoice-web`; si no, `403`.
- **Tipos generados del contrato.** `src/api/schema.ts` sale de `contracts/openapi.yaml`, copia del contrato de la API ([api-emite-facil](https://github.com/DevNation593/api-emite-facil/blob/dev/contracts/openapi.yaml)). No se edita a mano: `npm run api:generate` lo regenera y una prueba falla si está desactualizado. Cuando la API cambia su contrato, se copia aquí y se regenera; el CI falla si la copia no es la de la API de la misma rama.
- **Importes como cadenas.** La aritmética de la vista previa de la factura usa enteros (`BigInt`), nunca `number`. El total que vale es el que devuelve la API.
- **Política de contenido por respuesta.** `src/proxy.ts` da a cada página un valor de un solo uso y solo se ejecutan los scripts que lo llevan; por eso todas las páginas se generan al pedirlas.
- **Registro de eventos.** `src/server/log.ts` escribe una línea JSON por fallo que un operador necesita ver, sin tokens ni datos de la petición.
- **Borradores en el navegador.** La API no tiene borradores: se guardan en `localStorage`, por empresa. No se ven desde otro equipo. Cada borrador lleva su clave de idempotencia, así que emitirlo dos veces produce una sola factura.

## Estructura

| Ruta | Qué hay |
|---|---|
| `src/server/` | Configuración, sesión cifrada, llamadas a las cuentas de la API y reglas del proxy. Solo código de servidor. |
| `src/app/auth/`, `src/app/api/` | Ingreso, registro, confirmación del correo, recuperación de contraseña y salida; estado de la sesión y el proxy de la API. |
| `src/app/sign-in`, `sign-up`, `verify-email`, `forgot-password`, `reset-password` | Pantallas sin sesión. |
| `src/app/(app)/` | Las pantallas, que exigen sesión: comprobantes, facturas, clientes, productos, configuración, integraciones y la cuenta. |
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
| `APP_BASE_URL` | Dirección pública de esta aplicación (la misma que `EINVOICE_WEB_URL` de la API). Con `https`, las cookies llevan `Secure`; fuera de `localhost` es obligatorio. |
| `SESSION_SECRET` | Al menos 32 caracteres aleatorios. Cifra las cookies de sesión: cambiarlo cierra todas las sesiones. |
| `TRUSTED_PROXY_HOPS` | Opcional: cuántos proxies de confianza añaden su entrada a `X-Forwarded-For` (1). En Cloud Run, 1 con la web detrás del frente de Google y 2 con un balanceador HTTPS delante. |

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

Para arrancar todo en local (infraestructura, API y esta aplicación), ver [docs/DEVELOPMENT.md](https://github.com/DevNation593/api-emite-facil/blob/dev/docs/DEVELOPMENT.md) en el repositorio de la API.

## Límites conocidos

- **Las pruebas con navegador viven en el repositorio de la API**, en [`e2e/`](https://github.com/DevNation593/api-emite-facil/blob/dev/e2e/README.md): recorren la aplicación completa (esta compilación de producción y el jar de la API) contra un SRI simulado. Aquí las pantallas se prueban como componentes contra una API simulada, y el código de servidor (ingreso, renovación, cierre, proxy) contra respuestas simuladas de la API.
- **Solo se ha visto en Chromium**, en escritorio y en el ancho de un teléfono (375 px), donde ninguna pantalla principal se desplaza de lado; las tablas anchas se desplazan dentro de su caja. Lo que la revisión de las pantallas encontró y cómo quedó está en el [doc 15](https://github.com/DevNation593/api-emite-facil/blob/dev/docs/15-produccion.md).
- **"Comprobantes" tiene un listado por tipo del SRI** (facturas, notas de crédito y de débito, guías de remisión, liquidaciones de compra y retenciones), filtrado con `documentType`. Solo se emiten facturas y notas: los listados de guías, liquidaciones y retenciones avisan de que la plataforma aún no los emite y no ofrecen botón de emisión.
- **Las direcciones van en inglés** (`/documents/invoices`, `/customers`, `/sign-in`…), como las carpetas de `src/app`; los textos siguen en español. Las direcciones en español de antes (`/documentos`, `/ingresar`, `/verificar-correo`…) redirigen a las nuevas con su consulta y su fragmento, así que los enlaces de los correos de la API siguen funcionando. La lista está en `src/server/legacyRoutes.ts`.
- **Una sola forma de pago por factura** en el editor. Los productos, como los clientes, se buscan: la lista de cada línea muestra los 20 primeros resultados.
- **"Integraciones"** (propietario y administradores) registra las direcciones a las que avisar de lo que pasa con los comprobantes, muestra su secreto una sola vez y enseña los 20 avisos más recientes de cada una, sin paginar los anteriores. Si la instalación tiene los avisos apagados, registrar una dirección responde con un mensaje que lo dice.
- **No hay equipo ni invitaciones:** cada usuario trabaja en las empresas que crea, como propietario.
- **La IP del usuario sale de `X-Forwarded-For`.** La API limita los intentos de ingreso por IP con la que la web le pasa. Cada proxy de confianza añade su entrada al final de la cabecera y lo de la izquierda lo escribe el navegador, así que vale la entrada en la posición `TRUSTED_PROXY_HOPS` contando desde la derecha (detalle para Cloud Run en el [doc 13 de la API](https://github.com/DevNation593/api-emite-facil/blob/dev/docs/13-deployment.md)). Sin un proxy de entrada que fije esa cabecera, la pone el propio navegador y el límite por IP no sirve (el bloqueo por correo sí).
- **Los borradores quedan en el navegador al cerrar sesión.** En un equipo compartido, otra persona de la misma empresa que use el mismo perfil del navegador los vería.
- **Una sola instancia a efectos de renovación de sesión.** Las peticiones simultáneas comparten una renovación del token dentro de un mismo proceso; con varias instancias, la API vería dos veces el mismo token de renovación y cerraría la sesión: hace falta afinidad de sesión o un almacén compartido.
- **Solo español**, sin internacionalización.
