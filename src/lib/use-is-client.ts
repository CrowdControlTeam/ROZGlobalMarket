import { useSyncExternalStore } from "react";

// Devuelve false en el render de servidor y en la primera pasada de
// hidratación, y true a partir de ahí — sin useEffect (que la regla
// react-hooks/set-state-in-effect desaconseja) y sin desajuste de
// hidratación. Uso: portales que necesitan document.body, que no existe en
// SSR (ver UserPicker, UserMention). Sustituye al patrón
// `const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), [])`.
const subscribe = () => () => {};

export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true, // snapshot en cliente
    () => false, // snapshot en servidor / primer render de hidratación
  );
}
