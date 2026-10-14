"use client";

import { useEffect, useRef } from "react";

/**
 * Llama a `tick` cada `intervalMs` mientras `enabled` sea cierto, y como mucho durante `maxMs`: una
 * pestaña olvidada no consulta a la API para siempre.
 */
export function usePolling(tick: () => void, enabled: boolean, intervalMs = 5000, maxMs = 10 * 60 * 1000): void {
  const latest = useRef(tick);

  useEffect(() => {
    latest.current = tick;
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - startedAt > maxMs) {
        clearInterval(timer);
        return;
      }
      latest.current();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [enabled, intervalMs, maxMs]);
}
