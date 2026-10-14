import { vi } from "vitest";

/** Enrutador simulado: las pruebas comprueban a dónde navega una pantalla. */
export const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() };

/** Parámetros de ruta y ruta actual que verá el componente bajo prueba. */
export const route: { params: Record<string, string>; pathname: string; search: string } = { params: {}, pathname: "/", search: "" };
