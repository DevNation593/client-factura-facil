import type { InvoicePreview } from "@/lib/invoicePreview";

/**
 * Totales de la vista previa: base por tarifa, subtotal, descuento, IVA por tarifa y total. Es una
 * vista previa: el total que vale es el que calcula el servidor al emitir.
 */
export function PreviewTotals({ preview, rateDescriptions }: { preview: InvoicePreview; rateDescriptions: Map<string, string> }) {
  return (
    <>
      <h2>Totales</h2>
      <table className="ruled totals">
        <tbody>
          {preview.taxes.map((tax) => (
            <tr key={`base-${tax.rateCode}`}>
              <td>Subtotal {rateDescriptions.get(tax.rateCode) ?? `${tax.ratePercent}%`}</td>
              <td className="num">{tax.base}</td>
            </tr>
          ))}
          <tr>
            <td>Subtotal sin impuestos</td>
            <td className="num">{preview.subtotal}</td>
          </tr>
          <tr>
            <td>Descuento</td>
            <td className="num">{preview.totalDiscount}</td>
          </tr>
          {preview.taxes
            .filter((tax) => tax.amount !== "0.00")
            .map((tax) => (
              <tr key={`iva-${tax.rateCode}`}>
                {/* El catálogo describe la tarifa solo con su porcentaje ("15%"): el impuesto lo nombra la pantalla. */}
                <td>IVA {Number(tax.ratePercent)}%</td>
                <td className="num">{tax.amount}</td>
              </tr>
            ))}
          <tr>
            <td>Total</td>
            <td className="num" data-testid="total">
              {preview.total}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="field-hint">Vista previa. El total definitivo lo calcula el servidor al emitir.</p>
    </>
  );
}
