import { api, unwrap } from "@/api/client";

/** Punto de emisión habilitado, con el código de su establecimiento. */
export type Point = { establishmentCode: string; emissionPointCode: string };

export type Issuer = { taxpayerId: string; points: Point[] };

/**
 * Emisor con el que se emite y sus puntos de emisión habilitados. Por omisión, el primero de la
 * empresa; con `taxpayerId`, ese (por ejemplo, el de la factura que modifica una nota). Nulo si la
 * empresa todavía no tiene emisor.
 */
export async function loadIssuer(taxpayerId?: string): Promise<Issuer | null> {
  const taxpayers = await unwrap(api.GET("/taxpayers"));
  const taxpayer = taxpayers.find((candidate) => candidate.id === taxpayerId) ?? taxpayers[0];
  if (!taxpayer) {
    return null;
  }
  const establishments = await unwrap(
    api.GET("/taxpayers/{taxpayerId}/establishments", { params: { path: { taxpayerId: taxpayer.id } } }),
  );
  const points: Point[] = [];
  for (const establishment of establishments) {
    const list = await unwrap(api.GET("/emission-points", { params: { query: { establishmentId: establishment.id } } }));
    for (const point of list) {
      if (point.enabled) {
        points.push({ establishmentCode: establishment.code, emissionPointCode: point.code });
      }
    }
  }
  return { taxpayerId: taxpayer.id, points };
}
