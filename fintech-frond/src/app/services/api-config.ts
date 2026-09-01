/**
 * URL base del backend NestJS (fintech-back).
 *
 * Se detecta sola según dónde se esté ejecutando el frontend, para no
 * tener que editar este archivo a mano cada vez que cambias entre tu PC
 * y el servidor real (antes había que acordarse de "volver a poner
 * localhost" y se corría el riesgo de subir un despliegue apuntando a
 * localhost, o de probar en tu PC apuntando por error al servidor real):
 *
 *   - Si el navegador cargó la página desde "localhost" o "127.0.0.1"
 *     (es decir, corriste "ng serve" en tu PC), usa
 *     "http://localhost:3001/api" — el backend que corres localmente
 *     con Docker en el puerto 3001, con el prefijo global "/api" (ver
 *     fintech-back/src/main.ts).
 *   - En cualquier otro caso (el sitio real desplegado en Render, o
 *     cualquier otro dominio), usa el backend real en Render.
 *
 * Si alguna vez cambias el nombre del servicio backend en Render (hoy es
 * "fintech-back-api" en render.yaml), actualiza aquí la URL de
 * producción.
 */
const URL_BACKEND_LOCAL = 'http://localhost:3001/api';
const URL_BACKEND_PRODUCCION = 'https://fintech-back-api.onrender.com/api';

function esLocalhost(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '[::1]';
}

export const API_BASE_URL = esLocalhost() ? URL_BACKEND_LOCAL : URL_BACKEND_PRODUCCION;
