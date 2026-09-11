import { VctCalculator } from "./VctCalculator";

// Calculadora de Variable Casting Time. Sin fetch a BD: los datos de skills
// viven en el bundle (client-safe), así que todo el cálculo es en cliente.
// requireSession lo aplica el layout de /tools.
export default function VctToolPage() {
  return <VctCalculator />;
}
