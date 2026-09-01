/**
 * URL base del backend NestJS (fintech-back).
 *
 * En desarrollo local, "ng serve" corre en el puerto 4200 y el backend
 * ("npm run start:dev" dentro de fintech-back, vía Docker) corre en el
 * puerto 3001 con el prefijo global "/api" (ver fintech-back/src/main.ts).
 * Por eso queda así por defecto: para que tu entorno local siga
 * funcionando igual que hasta ahora.
 *
 * ANTES DE DESPLEGAR EL FRONTEND EN RENDER: cambia esta URL por la del
 * servicio backend real en Render (el que arma render.yaml se llama
 * "fintech-back-api", así que normalmente será
 * "https://fintech-back-api.onrender.com/api" — confírmalo en el
 * dashboard de Render por si el nombre ya estaba tomado), guarda,
 * comitea y sube el cambio. Recuerda volver a poner "localhost" aquí si
 * regresas a desarrollar en tu PC después.
 */
export const API_BASE_URL = 'https://fintech-back-api.onrender.com/api';
