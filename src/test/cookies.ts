/** Cookies de una petición, como las entrega `cookies()` de Next, para probar código de servidor. */
export type FakeCookieJar = {
  values: Map<string, string>;
  get(name: string): { name: string; value: string } | undefined;
  set(name: string, value: string): void;
  delete(name: string): void;
};

export function fakeCookieJar(initial: Record<string, string> = {}): FakeCookieJar {
  const values = new Map(Object.entries(initial));
  return {
    values,
    get: (name) => (values.has(name) ? { name, value: values.get(name) as string } : undefined),
    set: (name, value) => {
      values.set(name, value);
    },
    delete: (name) => {
      values.delete(name);
    },
  };
}

/** Guarda en el tarro los trozos de una cookie repartida (`nombre.0`, `nombre.1`…). */
export function putChunks(jar: FakeCookieJar, name: string, chunks: string[]): void {
  chunks.forEach((chunk, index) => jar.set(`${name}.${index}`, chunk));
}
