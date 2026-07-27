// Checkbox real (por accesibilidad/teclado y para que siga funcionando tal
// cual con FormData en los forms de servidor) pero visualmente oculto
// (peer sr-only) — el track y el thumb son hermanos suyos que reaccionan a
// su estado con peer-checked, sin JS propio.
export function ToggleSwitch({
  name,
  defaultChecked,
  label,
}: {
  name: string;
  defaultChecked?: boolean;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm text-ro-text">
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
        <span className="absolute inset-0 rounded-full bg-ro-panel-border transition-colors peer-checked:bg-ro-gold" />
        <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
      {label}
    </label>
  );
}
