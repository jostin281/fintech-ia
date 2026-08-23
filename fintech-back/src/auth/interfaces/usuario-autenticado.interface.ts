import type { Request } from 'express';

// Información que guardamos dentro del token JWT.
export interface UsuarioAutenticado {
  sub: number;
  correo: string;
  rol: 'USUARIO' | 'ADMINISTRADOR';
  iat?: number;
  exp?: number;
}

// Petición HTTP que ya fue validada por el guard.
export interface SolicitudAutenticada extends Request {
  usuario: UsuarioAutenticado;
}
