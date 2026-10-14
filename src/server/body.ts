/**
 * Lee un cuerpo hasta `limit` bytes. Nulo si lo supera: deja de leer en cuanto lo sabe, sin guardar
 * en memoria lo que venga detrás.
 */
export async function readUpTo(stream: ReadableStream<Uint8Array> | null, limit: number): Promise<Uint8Array<ArrayBuffer> | null> {
  if (stream === null) {
    return new Uint8Array(0);
  }
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    parts.push(value);
  }
  const whole = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    whole.set(part, offset);
    offset += part.byteLength;
  }
  return whole;
}
