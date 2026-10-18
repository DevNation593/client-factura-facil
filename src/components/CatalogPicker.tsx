"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ErrorNotice } from "@/components/Notice";
import { useApi } from "@/lib/useApi";
import { useDebounced } from "@/lib/useDebounced";

type Item = { id: string };

/** Selector que consulta el catálogo desde el mismo campo en el que se elige el registro. */
export function CatalogPicker<T extends Item>({
  id,
  "aria-label": ariaLabel,
  "aria-describedby": describedBy,
  tenantId,
  value,
  selectedLabel,
  placeholder,
  returnTo,
  load,
  optionLabel,
  onSearchStart,
  onSelect,
}: {
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  tenantId: string;
  value: string;
  selectedLabel: string;
  placeholder: string;
  returnTo?: string;
  load: (query: string) => Promise<T[]>;
  optionLabel: (item: T) => string;
  onSearchStart?: () => void;
  onSelect: (item: T) => void;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = `${generatedId}-opciones`;
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const searched = useDebounced(query.trim(), 300);
  const items = useApi(() => open ? load(searched) : Promise.resolve([]), [tenantId, open, searched]);
  const searching = query.trim() !== searched || items.loading;
  const choices = open && !searching ? items.data ?? [] : [];

  useEffect(() => {
    if (!open) {
      return;
    }
    function place() {
      const rect = input.current?.getBoundingClientRect();
      if (rect) {
        const above = window.innerHeight - rect.bottom < 220 && rect.top > window.innerHeight - rect.bottom;
        setPosition({ top: above ? Math.max(8, rect.top - 224) : rect.bottom, left: rect.left, width: rect.width });
      }
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  function choose(item: T) {
    onSelect(item);
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
    input.current?.blur();
  }

  return (
    <>
      <input
        ref={input}
        id={inputId}
        role="combobox"
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off"
        maxLength={100}
        placeholder={placeholder}
        value={open ? query : selectedLabel}
        onFocus={() => {
          setQuery("");
          setActiveIndex(-1);
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          if (value) {
            onSearchStart?.();
          }
          setQuery(event.target.value);
          setActiveIndex(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            input.current?.blur();
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((index) => Math.min(index + 1, choices.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => choices.length ? Math.max(0, index - 1) : -1);
          } else if (event.key === "Enter" && open) {
            event.preventDefault();
            if (activeIndex >= 0 && choices[activeIndex]) {
              choose(choices[activeIndex]);
            }
          }
        }}
      />
      {open && typeof document !== "undefined" ? createPortal(
        <div className="catalog-options" style={position}>
          <div id={listId} role="listbox" aria-label={ariaLabel ?? placeholder}>
            {searching ? <p className="field-hint">Buscando…</p> : choices.length === 0 ? <p className="field-hint">No hay coincidencias.</p> : null}
            {choices.map((item, index) => (
              <button
                key={item.id}
                id={`${listId}-${index}`}
                type="button"
                role="option"
                aria-selected={value === item.id}
                className={index === activeIndex ? "catalog-option active" : "catalog-option"}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(item)}
              >
                {optionLabel(item)}
              </button>
            ))}
          </div>
          <ErrorNotice error={items.error} returnTo={returnTo} />
        </div>,
        document.body,
      ) : null}
    </>
  );
}
