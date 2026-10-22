import { Field } from "@/components/Field";
import { DEFAULT_TIME_UNIT, TIME_UNITS, validTerm } from "@/lib/paymentTerm";

/** Plazo de pago y su unidad de tiempo, opcionales; salen en el XML y en el RIDE. */
export function PaymentTermFields({
  term,
  timeUnit,
  onChange,
}: {
  term: string;
  timeUnit: string;
  onChange: (patch: { term?: string; timeUnit?: string }) => void;
}) {
  return (
    <>
      <Field label="Plazo" hint="Opcional. Sale en el RIDE." error={validTerm(term) ? undefined : "Un número, con hasta dos decimales."}>
        <input className="num" inputMode="decimal" value={term} onChange={(event) => onChange({ term: event.target.value })} />
      </Field>
      <Field label="Unidad de tiempo">
        <select value={timeUnit || DEFAULT_TIME_UNIT} onChange={(event) => onChange({ timeUnit: event.target.value })}>
          {TIME_UNITS.map((unit) => (
            <option key={unit.value} value={unit.value}>
              {unit.label}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}
