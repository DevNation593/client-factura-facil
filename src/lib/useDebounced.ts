"use client";

import { useEffect, useState } from "react";

/** Devuelve el valor cuando lleva `delayMs` sin cambiar: para buscar al dejar de teclear, no en cada tecla. */
export function useDebounced<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}
