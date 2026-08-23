import { SetMetadata } from '@nestjs/common';

// Clave utilizada por el guard para reconocer rutas públicas.
export const CLAVE_RUTA_PUBLICA = 'rutaPublica';

// Decorador que permite acceder a una ruta sin token.
export const Publico = () => SetMetadata(CLAVE_RUTA_PUBLICA, true);
