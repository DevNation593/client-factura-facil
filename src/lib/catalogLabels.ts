/** Siglas que se dejan en mayúsculas. */
const ACRONYMS = new Set(["RUC", "IVA", "ICE", "IRBPNR"]);

/** Palabras que el catálogo sembrado escribe sin tilde (tal como la ficha técnica). */
const ACCENTS: Record<string, string> = { utilizacion: "utilización" };

/**
 * Nombre de un catálogo del SRI para leerlo en pantalla: la ficha los da en mayúsculas
 * ("SIN UTILIZACION DEL SISTEMA FINANCIERO") y aquí se muestran con mayúscula solo al principio,
 * con las siglas intactas. Lo que ya no está todo en mayúsculas se deja como viene.
 */
export function catalogLabel(name: string): string {
  if (name !== name.toLocaleUpperCase("es") || !/\p{L}/u.test(name)) {
    return name;
  }
  const words = name.split(" ").map((word) => {
    if (ACRONYMS.has(word)) {
      return word;
    }
    const lower = word.toLocaleLowerCase("es");
    return ACCENTS[lower] ?? lower;
  });
  const sentence = words.join(" ");
  return sentence.charAt(0).toLocaleUpperCase("es") + sentence.slice(1);
}
