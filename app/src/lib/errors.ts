/**
 * Extrae un mensaje legible de un error desconocido.
 *
 * Los errores de supabase-js (p.ej. {message, details, hint, code} que
 * devuelve PostgREST en `{ data, error }` cuando no se usa `.throwOnError()`)
 * son objetos planos, no instancias de `Error`. Si se hace `String(err)`
 * sobre ellos el resultado es literalmente "[object Object]", así que hay
 * que leer `.message` explícitamente antes de caer al mensaje genérico.
 */
export function getErrorMessage(err: unknown, fallback = 'Ha ocurrido un error inesperado.'): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const message = (err as { message: unknown }).message
    if (typeof message === 'string' && message.trim() !== '') return message
  }
  if (typeof err === 'string' && err.trim() !== '') return err
  return fallback
}
