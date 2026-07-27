export function Panel({
  title,
  headerAction,
  children,
  className,
}: {
  title?: string;
  // Elemento opcional a la derecha del título (p.ej. un botón/enlace) —
  // sin esto, la cabecera solo puede llevar texto.
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-lg border-4 border-ro-panel-border bg-ro-panel shadow-lg ${className ?? ""}`}
    >
      {title && (
        <div className="flex items-center justify-between gap-3 border-b-4 border-ro-panel-border bg-ro-panel-header px-4 py-2">
          <h2 className="font-heading text-xs tracking-wide text-ro-gold">
            {title}
          </h2>
          {headerAction}
        </div>
      )}
      <div className="p-4 text-ro-text">{children}</div>
    </div>
  );
}
