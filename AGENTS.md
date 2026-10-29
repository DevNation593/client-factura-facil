# AGENTS.md — aplicación web de facturación electrónica (client-factura-facil)

Aplicación Next.js (App Router) con TypeScript: una empresa se da de alta como emisor, carga su firma electrónica, mantiene clientes y productos, emite facturas y sigue su estado ante el SRI. La API, el contrato, la infraestructura y las pruebas con navegador viven en [api-emite-facil](https://github.com/DevNation593/api-emite-facil).

## Contexto que hay que leer

- `README.md`: cómo está hecha, la estructura de carpetas, las variables de entorno y los límites conocidos.
- `SECURITY.md`: qué se protege y qué no puede romper un cambio.
- En el repositorio de la API, `docs/10-security.md` (sección «Aplicación web») detalla cada control.

## Estructura

- `src/server/`: configuración, sesión cifrada, llamadas a las cuentas de la API y reglas del proxy. Solo código de servidor.
- `src/app/auth/`, `src/app/api/`: ingreso, registro, recuperación de contraseña y salida; estado de la sesión y el proxy `/api/backend/*`.
- `src/app/(app)/`: las pantallas que exigen sesión.
- `src/api/schema.ts`: tipos generados de `contracts/openapi.yaml`. No se editan a mano: `npm run api:generate`.
- `src/lib/`: aritmética decimal, vista previa de la factura, borradores y empresa activa.
- `src/proxy.ts` y `src/server/csp.ts`: la política de contenido con un nonce por respuesta.

## Comandos

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Convenciones

- Textos para el usuario, comentarios, documentación y commits en español, tratando al usuario de «usted»; identificadores de código en inglés.
- Commits con el formato `tipo(ámbito): descripción en español`, por ejemplo `feat(web): …` o `fix(deps): …`.
- Ramas: `dev` es la de integración y cada cambio entra por pull request a `dev`. De ahí se promueve a `qa` y luego a `main`.
- Cada pantalla tiene su prueba de componente (`*.test.tsx`) contra la API simulada de `src/test/`.

## Code Review Rules

### Cómo revisar

- Escribe la revisión en español.
- Señala solo defectos reales que puedas sostener con el código del diff y su contexto: una entrada concreta que produce un resultado incorrecto, un dato expuesto, una pantalla que se rompe. No comentes estilo, nombres ni formato: de eso se encargan ESLint y TypeScript.
- Cita el archivo y la línea, explica el escenario que falla y propone el arreglo mínimo.
- Antes de marcar algo como riesgo, comprueba si `SECURITY.md` o el `README.md` lo declaran como límite aceptado. Si es así, no lo marques, salvo que el cambio lo empeore.

### Qué es P0

Trátalo como P0 aunque el cambio parezca pequeño:

- Un token de acceso o de renovación, el `SESSION_SECRET` o una API key completa llegan al navegador: a un componente de cliente, a `localStorage`, a una cookie sin `httpOnly`, a una respuesta de `/api/session` o a un registro.
- El proxy `/api/backend/*` reenvía a otro host, a rutas fuera de `/api/v1/`, con segmentos sin validar (`..`, caracteres extraños), con métodos o cabeceras nuevos sin justificar, o deja pasar rutas de `/auth` que no son `me`, `password` y `email-verification/resend`.
- Una petición que cambia datos se acepta sin comprobar el mismo origen y la marca `X-Requested-With: einvoice-web`.
- Una redirección tras ingresar o salir puede llevar fuera del sitio: todo destino pasa por `safeReturnTo`.
- La política de contenido se relaja: `unsafe-inline` o `unsafe-eval` fuera de desarrollo, scripts u hojas de estilo de otros sitios, o HTML insertado con `dangerouslySetInnerHTML` a partir de datos.
- La pertenencia a una empresa se decide en el navegador en vez de dejarla a la API, o una pestaña puede escribir en la empresa activa de otra pestaña.
- El `.p12` o su contraseña se guardan en el navegador o quedan en el formulario tras enviarlo.

### Qué es P1

- Importes calculados con `number` en vez de la aritmética decimal de `src/lib/decimal.ts`, o un total mostrado como definitivo cuando el que vale es el que devuelve la API.
- `src/api/schema.ts` editado a mano, o `contracts/openapi.yaml` distinto del de la API en la misma rama.
- Emitir una factura sin la clave de idempotencia de su borrador, o generar una clave nueva al reintentar el mismo envío.
- Códigos de correo (confirmación, recuperación) leídos de la consulta en vez del fragmento `#token=…`, o que se quedan en la barra de direcciones.
- Una pantalla de `src/app/(app)/` que no maneja el error, la carga o el estado vacío que devuelve la API, o que muestra un error técnico sin traducir en vez de pasar por `src/api/problem.ts`.
- Estilos con el atributo `style` en línea o fuentes de terceros: la política de contenido los bloquea en producción aunque funcionen con `npm run dev`.
- Lógica o pantalla nueva sin prueba, o una prueba existente debilitada para que pase.
- Una pantalla que se desplaza de lado en el ancho de un teléfono (375 px), o controles sin nombre accesible o sin foco visible.
- `README.md` que deja de ser cierto por el cambio.

### Lo que no hay que marcar

- Los borradores en `localStorage` (contienen cliente, líneas e importes, no credenciales), que la renovación de sesión sea por proceso o que solo haya español: son límites documentados.
- Diferencias de formato que corrigen ESLint o el compilador.
