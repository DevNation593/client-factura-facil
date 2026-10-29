# Política de seguridad — aplicación web de facturación electrónica

## Versiones con soporte

| Rama | Soporte |
|---|---|
| `main` | Sí: es lo que se despliega. |
| `qa`, `dev` | Se corrigen, pero no se publican avisos por separado. |
| Otras ramas | No. |

## Cómo informar de una vulnerabilidad

No abras un issue público ni un pull request que describa el fallo.

Infórmalo de forma privada desde la pestaña **Security** del repositorio, con **Report a vulnerability**. Incluye:

- Qué pantalla, ruta o componente está afectado.
- Los pasos para reproducirlo, con el navegador y su versión, y qué consigue quien lo aprovecha.
- La rama o el commit en el que lo comprobaste.

Si el fallo está en la API y no en la web, infórmalo en [api-emite-facil](https://github.com/DevNation593/api-emite-facil/security). Te responderemos con una primera valoración y te avisaremos cuando el arreglo esté desplegado.

### Lo que no hay que hacer al investigar

- Pruebas contra cuentas, empresas o instalaciones que no sean tuyas. Usa el entorno local descrito en el `README.md`.
- Pruebas de denegación de servicio o de fuerza bruta contra entornos compartidos.

## Modelo de amenazas

Esta sección es la guía de seguridad para revisar cambios, también las revisiones automáticas. El detalle está en `docs/10-security.md` del repositorio de la API, sección «Aplicación web».

### Lo que se protege

- **La sesión del usuario**: tokens de acceso y de renovación, que viven solo en cookies cifradas (AES-256-GCM) `httpOnly`.
- **La empresa en la que se trabaja**: cada pestaña escribe solo en la suya.
- **La firma electrónica** (`.p12` y su contraseña) mientras pasa del formulario a la API.
- **Los códigos de los correos** de confirmación y de recuperación de contraseña.

### Fronteras de confianza

- **El navegador** no es de confianza: todo lo que manda (ruta, cabeceras, cuerpo, `x-return-to`, empresa activa) se valida en el servidor de Next o en la API.
- **El servidor de Next** guarda la sesión y es el único que habla con la API, por el proxy `/api/backend/*`.
- **La API** decide la pertenencia a cada empresa y los permisos. La web nunca los da por buenos por su cuenta.

### Invariantes que un cambio no puede romper

1. Ningún token ni secreto llega al JavaScript de la página, a `localStorage` ni a los registros.
2. El proxy solo reenvía a `${API_BASE_URL}/api/v1/…`, con los métodos que la API usa y las cabeceras imprescindibles. Decide si admite la petición antes de leer su cuerpo y corta en 1 MB.
3. Toda petición que cambia datos viene del mismo origen y lleva `X-Requested-With: einvoice-web`.
4. Tras ingresar o salir solo se redirige a rutas del propio sitio.
5. Cada página lleva su política de contenido con un nonce nuevo: fuera de desarrollo no se ejecutan scripts en línea ni `eval`, y no se carga nada de otros sitios.
6. Los códigos de los correos van en el fragmento de la dirección y la página los quita en cuanto los lee.
7. Fuera de `localhost`, `APP_BASE_URL` es `https` y las cookies de sesión llevan `Secure`.

### Límites aceptados

Son riesgos conocidos y documentados. No se informan como vulnerabilidad salvo que un cambio los amplíe:

- Los borradores de factura se guardan en `localStorage` y siguen ahí al cerrar sesión: en un perfil de navegador compartido, otra persona de la misma empresa los vería.
- La renovación del token se coordina por proceso: con varias instancias hace falta afinidad de sesión.
- La IP del usuario sale de `X-Forwarded-For`: sin un proxy de entrada que fije esa cabecera, el límite de intentos por IP de la API no sirve (el bloqueo por correo sí).
