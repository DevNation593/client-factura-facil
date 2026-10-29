import { DocumentList } from "../DocumentList";

/** Facturas emitidas y su estado ante el SRI, con el resumen de las últimas encima. */
export default function FacturasPage() {
  return <DocumentList type="01" summary />;
}
