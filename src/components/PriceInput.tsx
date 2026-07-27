"use client";

import { useState } from "react";
import { MaskedPriceInput } from "./MaskedPriceInput";

// Versión "de formulario" de MaskedPriceInput: guarda su propio estado y
// expone el valor sin formatear vía un input oculto, para que viaje en el
// FormData tal cual espera el server action (createListing, etc.).
export function PriceInput({
  name,
  defaultValue,
  placeholder,
  invalid,
}: {
  name: string;
  defaultValue?: number;
  placeholder?: string;
  // Ver MaskedPriceInput — solo se pinta en rojo mientras siga vacío, así
  // que en cuanto el usuario escribe algo el aviso desaparece solo.
  invalid?: boolean;
}) {
  const [value, setValue] = useState<number | "">(defaultValue ?? "");

  return (
    <>
      <MaskedPriceInput
        value={value}
        onChange={setValue}
        placeholder={placeholder}
        invalid={invalid && value === ""}
      />
      <input type="hidden" name={name} value={value} />
    </>
  );
}
