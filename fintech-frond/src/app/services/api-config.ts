/**
 * URL base del backend NestJS (fintech-back).
 *
 * En desarrollo, "ng serve" corre en el puerto 4200 y el backend
 * ("npm run start:dev" dentro de fintech-back) corre en el puerto 3000
 * con el prefijo global "/api" (ver fintech-back/src/main.ts).
 *
 * Si despliegas el backend en otra URL, cambia este valor (o conviértelo
 * en variable de entorno de build si más adelante usas varios ambientes).
 */
export const API_BASE_URL = 'http://localhost:3001/api';
