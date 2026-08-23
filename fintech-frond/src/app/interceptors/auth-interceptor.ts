import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth';
import { API_BASE_URL } from '../services/api-config';

/**
 * Agrega el token JWT (Bearer) a toda petición dirigida al backend, y
 * cierra la sesión automáticamente si el backend responde 401
 * (token ausente, inválido o expirado).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const esPeticionAlBackend = req.url.startsWith(API_BASE_URL);
  const token = auth.getToken();

  const solicitud = esPeticionAlBackend && token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(solicitud).pipe(
    catchError((error: unknown) => {
      if (
        esPeticionAlBackend &&
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !req.url.endsWith('/auth/login') &&
        !req.url.endsWith('/auth/registro')
      ) {
        auth.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};
