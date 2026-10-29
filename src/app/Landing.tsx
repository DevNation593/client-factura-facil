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

/**
 * Precios mensuales sin IVA; el pago anual cobra diez meses. Los planes solo cambian el volumen en producción y
 * las empresas: las funciones son las mismas en todos.
 */
const PLANS = [
  {
    name: "Gratis",
    price: "$0",
    yearly: "Para siempre",
    quota: "15 comprobantes al mes",
    companies: "1 empresa",
    fit: "Para facturar de vez en cuando o probar con un cliente real.",
    cta: "Empezar gratis",
  },
  {
    name: "Emprendedor",
    price: "$4",
    yearly: "o $40 al año",
    quota: "80 comprobantes al mes",
    companies: "1 empresa",
    fit: "Profesionales y negocios pequeños que facturan cada semana.",
    cta: "Elegir Emprendedor",
  },
  {
    name: "Pyme",
    price: "$9",
    yearly: "o $90 al año",
    quota: "250 comprobantes al mes",
    companies: "Hasta 3 empresas",
    fit: "Ventas diarias, o un punto de venta que emite por la API.",
    cta: "Elegir Pyme",
    featured: true,
  },
  {
    name: "Empresa",
    price: "$19",
    yearly: "o $190 al año",
    quota: "Comprobantes sin límite",
    companies: "Hasta 10 empresas",
    fit: "Estudios contables y sistemas con volumen alto.",
    cta: "Elegir Empresa",
  },
];

const QUESTIONS = [
  {
    question: "¿Necesito firma electrónica?",
    answer:
      "Sí. El SRI exige que cada comprobante vaya firmado con un certificado .p12 de una entidad de certificación. Se compra aparte; usted lo sube una vez y la aplicación firma con él.",
  },
  {
    question: "¿Puedo probar antes de pagar?",
    answer:
      "Toda cuenta empieza en el ambiente de pruebas del SRI, sin costo y sin límite. Esos comprobantes no tienen validez tributaria y no cuentan para su plan.",
  },
  {
    question: "¿Cuándo paso a producción?",
    answer:
      "Cuando tenga un comprobante autorizado en pruebas y su RUC esté habilitado para facturar electrónicamente. Lo activa desde la configuración de su empresa.",
  },
  {
    question: "¿Qué cuenta como comprobante?",
    answer: "Cada factura, nota de crédito o nota de débito que el SRI autoriza en producción.",
  },
];

const INCLUDED = [
  "Facturas y notas de crédito y débito",
  "Envío al SRI con reintentos",
  "XML y RIDE por correo a su cliente",
  "Archivo de todo lo autorizado",
  "API con idempotencia y webhooks",
  "Ambiente de pruebas sin límite",
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
        <div className={`${styles.wrap} ${styles.topBar}`}>
          <Link href="/" className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true" />
            Facturación electrónica
          </Link>
          <nav className={styles.nav} aria-label="Portada">
            <a href="#recorrido">Cómo funciona</a>
            <a href="#integraciones">Para sus sistemas</a>
            <a href="#planes">Planes</a>
            <a href="#preguntas">Preguntas</a>
          </nav>
          <div className={styles.account}>
            <Link href="/sign-in" className={styles.signIn}>
              Ingresar
            </Link>
            <Link href="/sign-up" className="btn btn-primary">
              Crear cuenta
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className={styles.hero} aria-labelledby="portada-titulo">
          <div className={`${styles.wrap} ${styles.heroGrid}`}>
            <div className={styles.heroText}>
              <h1 id="portada-titulo">
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
                <a href="#planes" className="btn">
                  Ver planes
                </a>
              </div>
              <ul className={styles.heroFacts}>
                <li>Empieza en el ambiente de pruebas del SRI, sin costo</li>
                <li>Plan gratuito con 15 comprobantes al mes</li>
                <li>Facturas y notas de crédito y débito</li>
              </ul>
            </div>
            <SampleInvoice />
          </div>
        </section>

        <section id="recorrido" className={styles.section} aria-labelledby="recorrido-titulo">
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <h2 id="recorrido-titulo">Qué pasa después de emitir</h2>
              <p>Usted pulsa «Emitir» una vez. Lo demás ocurre solo y queda a la vista en cada comprobante.</p>
            </div>
            <ol className={styles.steps}>
              {STEPS.map((step) => (
                <li key={step.title}>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionAlt}`} aria-labelledby="cuenta-titulo">
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <h2 id="cuenta-titulo">Lo que trae su cuenta</h2>
              <p>Lo que necesita para facturar cada día, sin hojas de cálculo aparte.</p>
            </div>
            <dl className={styles.features}>
              {FEATURES.map((feature) => (
                <div key={feature.term}>
                  <dt>{feature.term}</dt>
                  <dd>{feature.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="integraciones" className={`${styles.section} ${styles.integrations}`} aria-labelledby="integraciones-titulo">
          <div className={`${styles.wrap} ${styles.integrationsGrid}`}>
            <div>
              <h2 id="integraciones-titulo">Para sus sistemas</h2>
              <p>
                Su ERP, punto de venta o tienda en línea puede emitir facturas con una clave de API, sin pasar por la
                pantalla.
              </p>
              <dl className={styles.apiPoints}>
                <div>
                  <dt>Sin duplicados</dt>
                  <dd>Cada factura lleva una clave de idempotencia: si la petición se repite, la factura no se duplica.</dd>
                </div>
                <div>
                  <dt>Avisos al instante</dt>
                  <dd>
                    Su sistema recibe un aviso cada vez que el SRI autoriza o devuelve un comprobante, firmado con un
                    secreto que solo usted conoce.
                  </dd>
                </div>
              </dl>
            </div>
            <figure className={styles.terminal}>
              <figcaption>Emitir una factura</figcaption>
              <pre className={styles.snippet} aria-label="Ejemplo de llamada a la API">
                <code>{`curl -X POST https://su-dominio/api/v1/invoices \\
  -H "X-Api-Key: efk_…" \\
  -H "Idempotency-Key: 7c2e9a40-…" \\
  -H "Content-Type: application/json" \\
  -d @factura.json`}</code>
              </pre>
            </figure>
          </div>
        </section>

        <section id="planes" className={styles.section} aria-labelledby="planes-titulo">
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <h2 id="planes-titulo">Planes</h2>
              <p>
                Todos traen la aplicación completa. Cambia cuántos comprobantes autoriza el SRI al mes y cuántas
                empresas lleva.
              </p>
            </div>
            <ul className={styles.plans}>
              {PLANS.map((plan) => (
                <li key={plan.name} className={plan.featured ? styles.featured : undefined} aria-label={`Plan ${plan.name}`}>
                  <div className={styles.planHead}>
                    <h3>{plan.name}</h3>
                    {plan.featured && <span className={styles.badge}>Recomendado</span>}
                  </div>
                  <p className={styles.price}>
                    <strong>{plan.price}</strong> al mes
                  </p>
                  <p className={styles.yearly}>{plan.yearly}</p>
                  <ul className={styles.limits}>
                    <li>{plan.quota}</li>
                    <li>{plan.companies}</li>
                  </ul>
                  <p className={styles.fit}>{plan.fit}</p>
                  <Link href="/sign-up" className={plan.featured ? "btn btn-primary" : "btn"}>
                    {plan.cta}
                  </Link>
                </li>
              ))}
            </ul>
            <div className={styles.included}>
              <h3>En todos los planes</h3>
              <ul>
                {INCLUDED.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <p className={styles.fineprint}>
              Precios en dólares, más IVA. Pagando el año completo, dos meses van por nuestra cuenta. La firma
              electrónica (.p12) se compra aparte a una entidad de certificación.
            </p>
          </div>
        </section>

        <section id="preguntas" className={`${styles.section} ${styles.sectionAlt}`} aria-labelledby="preguntas-titulo">
          <div className={`${styles.wrap} ${styles.faqGrid}`}>
            <div className={styles.sectionHead}>
              <h2 id="preguntas-titulo">Preguntas frecuentes</h2>
              <p>Lo que más se pregunta antes de emitir la primera factura.</p>
            </div>
            <div className={styles.faq}>
              {QUESTIONS.map((item) => (
                <details key={item.question}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.foot}>
        <div className={`${styles.wrap} ${styles.footGrid}`}>
          <div>
            <span className={styles.brand}>
              <span className={styles.brandMark} aria-hidden="true" />
              Facturación electrónica
            </span>
            <p>Comprobantes electrónicos autorizados por el SRI de Ecuador.</p>
          </div>
          <nav className={styles.footNav} aria-label="Pie de página">
            <a href="#recorrido">Cómo funciona</a>
            <a href="#integraciones">Para sus sistemas</a>
            <a href="#planes">Planes</a>
            <a href="#preguntas">Preguntas</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
