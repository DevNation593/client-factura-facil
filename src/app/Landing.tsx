import Link from "next/link";

import styles from "./landing.module.css";

/** Clave de acceso de la factura de muestra: fecha, tipo, RUC, ambiente de pruebas, serie, secuencial, código y dígito verificador. */
const SAMPLE_ACCESS_KEY = "2710202601179001234500110010010000001271234567817";

const STEPS = [
  {
    title: "Se numera",
    text: "Toma el siguiente secuencial de su punto de emisión y arma la clave de acceso de 49 dígitos. Un número nunca se repite ni se salta.",
  },
  {
    title: "Se firma",
    text: "El XML se valida contra el esquema del SRI y se firma en XAdES-BES con su certificado.",
  },
  {
    title: "Se envía al SRI",
    text: "Pasa por recepción y autorización. Si el SRI no responde, se reintenta y se vuelve a consultar hasta tener una respuesta.",
  },
  {
    title: "Llega a su cliente",
    text: "Su cliente recibe por correo el XML autorizado y el RIDE en PDF.",
  },
  {
    title: "Queda archivada",
    text: "El XML y el RIDE se guardan tal como se autorizaron. Los descarga cuando los necesite.",
  },
];

const FEATURES = [
  {
    term: "Varias empresas",
    text: "Cada empresa lleva sus datos aparte. Cambie de una a otra sin cerrar sesión.",
  },
  {
    term: "Su firma electrónica",
    text: "Suba el archivo .p12 una vez. Se guarda cifrado, nunca se vuelve a mostrar y usted ve hasta cuándo vale.",
  },
  {
    term: "Clientes y productos",
    text: "Búsquelos mientras factura. La cédula y el RUC se validan al registrarlos.",
  },
  {
    term: "Borradores",
    text: "Deje una factura a medias y termínela después. Emitirla dos veces produce una sola factura.",
  },
  {
    term: "Estado de cada comprobante",
    text: "Vea en qué va cada factura ante el SRI y, si la devuelve, qué mensaje dio para corregirla y reenviarla.",
  },
  {
    term: "Paso a producción",
    text: "Empiece en el ambiente de pruebas. Con un comprobante autorizado y su RUC habilitado, active producción.",
  },
];

function SampleInvoice() {
  return (
    <figure className={styles.sheet} aria-label="Factura de muestra autorizada por el SRI">
      <div className={styles.copy} aria-hidden="true" />
      <div className={styles.original}>
        <div className={styles.sheetHead}>
          <div>
            <strong>Comercial Andina S.A.</strong>
            <span>RUC 1790012345001</span>
          </div>
          <div className={styles.sheetNumber}>
            <span>Factura</span>
            <strong>001-001-000000127</strong>
          </div>
        </div>

        <dl className={styles.sheetBuyer}>
          <div>
            <dt>Cliente</dt>
            <dd>Ferretería El Tornillo</dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>27/10/2026</dd>
          </div>
        </dl>

        <table className={styles.sheetLines}>
          <thead>
            <tr>
              <th scope="col">Descripción</th>
              <th scope="col">Cant.</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Mantenimiento de equipos</td>
              <td>2</td>
              <td>80,00</td>
            </tr>
            <tr>
              <td>Repuesto de filtro</td>
              <td>4</td>
              <td>40,00</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Subtotal 15 %</td>
              <td>120,00</td>
            </tr>
            <tr>
              <td colSpan={2}>IVA 15 %</td>
              <td>18,00</td>
            </tr>
            <tr>
              <td colSpan={2}>Valor total</td>
              <td>138,00</td>
            </tr>
          </tfoot>
        </table>

        <div className={styles.sheetKey}>
          <span>Clave de acceso</span>
          <code>{SAMPLE_ACCESS_KEY}</code>
        </div>

        <p className={styles.stamp} aria-hidden="true">
          Autorizado
          <small>Ambiente de pruebas</small>
        </p>
      </div>
    </figure>
  );
}

/** Portada pública: qué hace la aplicación y por dónde se entra. Siempre en claro: su factura es de papel. */
export function Landing() {
  return (
    <div className={`${styles.page} tema-claro`}>
      <header className={styles.top}>
        <Link href="/" className={styles.brand}>
          Facturación electrónica
        </Link>
        <nav className={styles.nav} aria-label="Portada">
          <a href="#recorrido">Cómo funciona</a>
          <a href="#integraciones">Para sus sistemas</a>
          <Link href="/sign-in">Ingresar</Link>
          <Link href="/sign-up" className="btn btn-primary">
            Crear cuenta
          </Link>
        </nav>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <h1>
              Llene la factura.
              <br />
              Del SRI nos encargamos nosotros.
            </h1>
            <p className={styles.heroLead}>
              Facturación electrónica para Ecuador: la aplicación numera cada factura, la firma con su certificado, la
              envía al SRI hasta tener la autorización y le manda a su cliente el XML y el RIDE.
            </p>
            <div className={styles.heroActions}>
              <Link href="/sign-up" className="btn btn-primary">
                Crear cuenta
              </Link>
              <Link href="/sign-in" className="btn">
                Ingresar
              </Link>
            </div>
            <p className={styles.heroNote}>
              Su cuenta empieza en el ambiente de pruebas del SRI. Pasa a producción cuando su RUC esté habilitado.
            </p>
          </div>
          <SampleInvoice />
        </section>

        <section id="recorrido" className={styles.section} aria-labelledby="recorrido-titulo">
          <h2 id="recorrido-titulo">Qué pasa después de emitir</h2>
          <p className={styles.sectionLead}>
            Usted pulsa «Emitir» una vez. Lo demás ocurre solo y queda a la vista en cada comprobante.
          </p>
          <ol className={styles.steps}>
            {STEPS.map((step) => (
              <li key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.section} aria-labelledby="cuenta-titulo">
          <h2 id="cuenta-titulo">Lo que trae su cuenta</h2>
          <dl className={styles.features}>
            {FEATURES.map((feature) => (
              <div key={feature.term}>
                <dt>{feature.term}</dt>
                <dd>{feature.text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="integraciones" className={`${styles.section} ${styles.integrations}`} aria-labelledby="integraciones-titulo">
          <div>
            <h2 id="integraciones-titulo">Para sus sistemas</h2>
            <p>
              Su ERP, punto de venta o tienda en línea puede emitir facturas con una clave de API, sin pasar por la
              pantalla. Cada factura lleva una clave de idempotencia: si la petición se repite, la factura no se duplica.
            </p>
            <p>
              Registre una dirección y su sistema recibe un aviso cada vez que el SRI autoriza o devuelve un
              comprobante, firmado con un secreto que solo usted conoce.
            </p>
          </div>
          <pre className={styles.snippet} aria-label="Ejemplo de llamada a la API">
            <code>{`curl -X POST https://su-dominio/api/v1/invoices \\
  -H "X-Api-Key: efk_…" \\
  -H "Idempotency-Key: 7c2e9a40-…" \\
  -H "Content-Type: application/json" \\
  -d @factura.json`}</code>
          </pre>
        </section>

        <section className={styles.closing} aria-labelledby="empezar-titulo">
          <h2 id="empezar-titulo">Emita su primera factura de prueba hoy</h2>
          <p>Cree su cuenta, registre su empresa y suba su firma electrónica.</p>
          <Link href="/sign-up" className="btn btn-primary">
            Crear cuenta
          </Link>
        </section>
      </main>

      <footer className={styles.foot}>
        <span>Facturación electrónica para el SRI de Ecuador.</span>
        <span>
          ¿Ya tiene cuenta? <Link href="/sign-in">Ingresar</Link>
        </span>
      </footer>
    </div>
  );
}
