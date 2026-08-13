"use client";

import { formatNumber, priceColorClass, MAX_INT } from "@/lib/price";
import { inputClass } from "@/lib/ui";

// Input de texto controlado para cualquier campo de moneda/precio/coste:
// aplica la máscara de separador de miles y el color por rango mientras se
// escribe. Reutilizado tanto en formularios (vía PriceInput) como en los
// filtros de precio mín./máx. del mercado.
export function MaskedPriceInput({
  value,
  onChange,
  placeholder,
  className,
  invalid,
}: {
  value: number | "";
  onChange: (value: number | "") => void;
  placeholder?: string;
  className?: string;
  // Borde rojo cuando el campo era obligatorio y se envió vacío — estilo
  // inline porque un className condicional pierde contra el orden interno
  // con el que Tailwind genera focus:border-ro-accent (ver mismo patrón
  // en PublishForm para las options fuera de rango).
  invalid?: boolean;
}) {
  function handleChange(raw: string) {
    const digits = raw.replace(/\D/g, "");
    // Se recorta al máximo de un INT: así el campo nunca deja escribir un
    // valor que la base rechazaría por overflow (ver MAX_INT).
    onChange(digits === "" ? "" : Math.min(Number(digits), MAX_INT));
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={value === "" ? "" : formatNumber(value)}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder}
      className={`${className ?? inputClass} ${value === "" ? "" : `font-semibold ${priceColorClass(value)}`}`}
      style={invalid ? { borderColor: "#dc2626" } : undefined}
    />
  );
}
