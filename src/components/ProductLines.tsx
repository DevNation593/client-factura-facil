"use client";

import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";
import { CatalogPicker } from "@/components/CatalogPicker";
import { formatUnitPrice } from "@/lib/decimal";

type Product = components["schemas"]["Product"];

/** Línea escrita con un producto del catálogo, como en la factura. */
export type ProductLine = { productId: string; quantity: string; unitPrice: string; discount: string };

export function emptyProductLine(): ProductLine {
  return { productId: "", quantity: "1", unitPrice: "", discount: "0.00" };
}

async function searchProducts(query: string) {
  const page = await unwrap(api.GET("/products", { params: { query: { size: 20, ...(query ? { q: query } : {}) } } }));
  return page.items;
}

/**
 * Detalle de productos del catálogo: producto, cantidad, precio, descuento y el subtotal de la vista
 * previa, con «Añadir línea» y «Quitar». `products` son los productos ya vistos, para nombrar los de
 * las líneas; cada producto elegido se avisa con `onProductSeen`.
 */
export function ProductLines({
  tenantId,
  lines,
  products,
  subtotals,
  returnTo,
  onChange,
  onProductSeen,
}: {
  tenantId: string;
  lines: ProductLine[];
  products: Map<string, Product>;
  subtotals: (string | null)[];
  returnTo?: string;
  onChange: (lines: ProductLine[]) => void;
  onProductSeen: (product: Product) => void;
}) {
  function changeLine(index: number, patch: Partial<ProductLine>) {
    onChange(lines.map((line, position) => (position === index ? { ...line, ...patch } : line)));
  }

  return (
    <>
      <div className="table-scroll">
        <table className="ruled lines">
          <thead>
            <tr>
              <th scope="col">Producto</th>
              <th scope="col" className="num">
                Cantidad
              </th>
              <th scope="col" className="num">
                Precio unitario
              </th>
              <th scope="col" className="num">
                Descuento
              </th>
              <th scope="col" className="num">
                Subtotal
              </th>
              <th scope="col">
                <span className="sr-only">Quitar</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index}>
                <td className="field">
                  <CatalogPicker
                    aria-label={`Producto de la línea ${index + 1}`}
                    tenantId={tenantId}
                    value={line.productId}
                    selectedLabel={products.has(line.productId)
                      ? `${products.get(line.productId)?.name} (${products.get(line.productId)?.sku})`
                      : line.productId ? "Producto no disponible" : ""}
                    placeholder="Elija o busque un producto"
                    returnTo={returnTo}
                    load={searchProducts}
                    optionLabel={(product) => `${product.name} (${product.sku})`}
                    onSearchStart={() => changeLine(index, { productId: "", unitPrice: "" })}
                    onSelect={(product) => {
                      onProductSeen(product);
                      changeLine(index, { productId: product.id, unitPrice: formatUnitPrice(product.unitPrice) });
                    }}
                  />
                </td>
                <td className="field">
                  <input
                    aria-label={`Cantidad de la línea ${index + 1}`}
                    className="num"
                    inputMode="decimal"
                    size={8}
                    value={line.quantity}
                    onChange={(event) => changeLine(index, { quantity: event.target.value })}
                  />
                </td>
                <td className="field">
                  <input
                    aria-label={`Precio unitario de la línea ${index + 1}`}
                    className="num"
                    inputMode="decimal"
                    size={10}
                    value={line.unitPrice}
                    onChange={(event) => changeLine(index, { unitPrice: event.target.value })}
                  />
                </td>
                <td className="field">
                  <input
                    aria-label={`Descuento de la línea ${index + 1}`}
                    className="num"
                    inputMode="decimal"
                    size={8}
                    value={line.discount}
                    onChange={(event) => changeLine(index, { discount: event.target.value })}
                  />
                </td>
                <td className="num">{subtotals[index] ?? "Incompleta"}</td>
                <td>
                  {lines.length > 1 ? (
                    <button type="button" className="btn-link" onClick={() => onChange(lines.filter((_, position) => position !== index))}>
                      Quitar <span className="sr-only">la línea {index + 1}</span>
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="actions">
        <button type="button" className="btn" onClick={() => onChange([...lines, emptyProductLine()])}>
          Añadir línea
        </button>
      </p>
    </>
  );
}
