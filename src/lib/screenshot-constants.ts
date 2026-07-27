// Tope de tamaño de la captura del tooltip que se sube para el
// reconocimiento por IA. Compartido entre el cliente (ScreenshotDropzone, que
// lo rechaza antes de subir) y el servidor (recognizeItemFromScreenshot, que
// lo revalida — no se confía en el cliente) y alineado con
// serverActions.bodySizeLimit en next.config.ts. Una captura de tooltip es
// pequeña; 5 MB deja margen de sobra sin permitir subidas enormes.
export const MAX_SCREENSHOT_MB = 5;
export const MAX_SCREENSHOT_BYTES = MAX_SCREENSHOT_MB * 1024 * 1024;
