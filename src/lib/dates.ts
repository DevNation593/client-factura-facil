const dateTime = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guayaquil" });

/** Fecha de emisión (AAAA-MM-DD) como dd/mm/aaaa, sin pasar por zonas horarias. */
export function formatIssueDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return year && month && day ? `${day}/${month}/${year}` : isoDate;
}

/** Instante de la API en hora de Ecuador. */
export function formatInstant(instant: string | null | undefined): string {
  if (!instant) {
    return "";
  }
  const date = new Date(instant);
  return Number.isNaN(date.getTime()) ? instant : dateTime.format(date);
}
