"use client";

import type { Point } from "@/lib/issuer";

/** Selector del punto de emisión habilitado ("001-002") con el que se emite. */
export function PointSelect({
  id,
  "aria-describedby": describedBy,
  points,
  value,
  onChange,
}: {
  id?: string;
  "aria-describedby"?: string;
  points: Point[];
  value: Point | undefined;
  onChange: (point: Point) => void;
}) {
  return (
    <select
      id={id}
      aria-describedby={describedBy}
      value={value ? `${value.establishmentCode}-${value.emissionPointCode}` : ""}
      onChange={(event) => {
        const [establishmentCode = "", emissionPointCode = ""] = event.target.value.split("-");
        onChange({ establishmentCode, emissionPointCode });
      }}
    >
      {points.map((candidate) => (
        <option key={`${candidate.establishmentCode}-${candidate.emissionPointCode}`}>
          {candidate.establishmentCode}-{candidate.emissionPointCode}
        </option>
      ))}
    </select>
  );
}
