"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Loaded<T> = {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  /** Vuelve a cargar. Con `quiet`, sin mostrar el estado de carga (para refrescos periódicos). */
  reload: (options?: { quiet?: boolean }) => Promise<void>;
};

type Settled<T> = { key: string | null; data: T | undefined; error: unknown };

/**
 * Carga datos de la API al montar el componente y cada vez que cambian las dependencias. Si llega
 * una respuesta de una carga anterior después de otra más reciente, se descarta.
 */
export function useApi<T>(load: () => Promise<T>, deps: readonly unknown[]): Loaded<T> {
  const key = JSON.stringify(deps);
  const [settled, setSettled] = useState<Settled<T>>({ key: null, data: undefined, error: undefined });
  const latest = useRef(0);
  const loader = useRef(load);

  // La función de carga puede cambiar en cada render; siempre se usa la más reciente.
  useEffect(() => {
    loader.current = load;
  });

  const run = useCallback((forKey: string): Promise<void> => {
    const ticket = ++latest.current;
    return loader.current().then(
      (data) => {
        if (ticket === latest.current) {
          setSettled({ key: forKey, data, error: undefined });
        }
      },
      (error: unknown) => {
        if (ticket === latest.current) {
          setSettled((current) => ({ key: forKey, data: current.data, error }));
        }
      },
    );
  }, []);

  useEffect(() => {
    void run(key);
  }, [key, run]);

  const reload = useCallback(
    (options?: { quiet?: boolean }) => {
      if (!options?.quiet) {
        setSettled((current) => ({ ...current, key: null }));
      }
      return run(key);
    },
    [key, run],
  );

  return { data: settled.data, error: settled.error, loading: settled.key !== key, reload };
}
