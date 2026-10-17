/**
 * Nombre común (CN) de un nombre distinguido como "CN=ANA PEREZ,SERIALNUMBER=…,O=…,C=EC", que es
 * como viene el titular de un certificado. Respeta las comas escapadas ("PEREZ\, JUAN"). Si no hay
 * CN, devuelve el nombre completo: mejor algo largo que un hueco.
 */
export function commonName(distinguishedName: string): string {
  for (const part of distinguishedName.split(/(?<!\\),/)) {
    const match = /^\s*CN=(.*)$/i.exec(part);
    if (match) {
      return match[1]!.trim().replace(/\\(.)/g, "$1");
    }
  }
  return distinguishedName;
}

/**
 * Nombre del titular de un certificado, para mostrarlo: su CN sin la cédula o el RUC con que
 * algunas entidades lo empiezan ("2101137889 STIWAR SALTOS" → "STIWAR SALTOS").
 */
export function holderName(subject: string): string {
  const name = commonName(subject);
  return name.replace(/^\d{10}(\d{3})?\s+(?=\S)/, "");
}
