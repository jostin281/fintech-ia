import type { Request } from 'express';

// Información que guardamos dentro del token JWT.
export interface UsuarioAutenticado {
  sub: number;
  correo: string;
  rol: 'USUARIO' | 'ADMINISTRADOR';
  // Verdadero cuando el token pertenece a una sesión demo temporal
  // (ver DemoService). Los guards lo usan para bloquear funciones sensibles.
  esDemo?: boolean;
  iat?: number;
  exp?: number;
}

// Petición HTTP que ya fue validada por el guard.
export interface SolicitudAutenticada extends Request {
  usuario: UsuarioAutenticado;
}
