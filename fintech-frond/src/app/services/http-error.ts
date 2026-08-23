import { HttpErrorResponse } from '@angular/common/http';

/** Extrae un mensaje legible de un error HTTP del backend (incluye validaciones class-validator). */
export function mensajeDeError(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const cuerpo = error.error as { message?: string | string[] } | null;
    if (cuerpo?.message) {
      return Array.isArray(cuerpo.message) ? cuerpo.message.join(' ') : cuerpo.message;
    }
    if (error.status === 0) {
      return 'No se pudo conectar con el servidor. Verifica que el backend esté corriendo.';
    }
  }
  return fallback;
}
