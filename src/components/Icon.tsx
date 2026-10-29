/** Trazos de cada icono, dibujados en una cuadrícula de 24 × 24 con línea de 1,75. */
const PATHS = {
  invoice: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  "note-minus": "M7 3h7l5 5v13H7zM14 3v5h5M10 15h6",
  "note-plus": "M7 3h7l5 5v13H7zM14 3v5h5M10 15h6M13 12v6",
  truck: "M3 6h11v10H3zM14 10h4l3 3v3h-7M5.2 18a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0M15.2 18a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0",
  bag: "M5 8h14l-1 12H6zM9 8a3 3 0 0 1 6 0",
  percent: "M19 5 5 19M4.5 7a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0M14.5 17a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0",
  users: "M5.8 8a3.2 3.2 0 1 0 6.4 0 3.2 3.2 0 1 0-6.4 0M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3 3 0 0 1 0 6M17.5 14.2c2 .7 3.5 2.8 3.5 5.8",
  box: "M12 3 4 7v10l8 4 8-4V7zM4 7l8 4 8-4M12 11v10",
  building: "M4 21V5l8-2v18M12 9h8v12M2 21h20M7.5 8h1M7.5 12h1M7.5 16h1M15.5 13h1M15.5 17h1",
  id: "M3 5h18v14H3zM6.8 11a2.2 2.2 0 1 0 4.4 0 2.2 2.2 0 1 0-4.4 0M5.5 16c.6-1.7 2-2.6 3.5-2.6s2.9.9 3.5 2.6M15 10h3M15 13h3",
  shield: "M12 3l7 3v6c0 4.2-3 7.5-7 9-4-1.5-7-4.8-7-9V6zM9 12l2 2 4-4",
  plug: "M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-10 0zM12 16v5",
  user: "M8 8a4 4 0 1 0 8 0 4 4 0 1 0-8 0M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  draft: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  send: "M4 12 20 4l-6 16-3-7zM11 13l9-9",
  key: "M4 15a4 4 0 1 0 8 0 4 4 0 1 0-8 0M11 12l9-9M17 6l3 3M14.5 8.5l2 2",
} as const;

export type IconName = keyof typeof PATHS;

/** Icono de línea que acompaña a un texto: decorativo, los lectores de pantalla lo saltan. */
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
