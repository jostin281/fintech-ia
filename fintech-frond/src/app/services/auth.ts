import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from './api-config';
import { mensajeDeError } from './http-error';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'USUARIO' | 'ADMINISTRADOR';
}

interface AuthResult {
  success: boolean;
  message?: string;
}

interface RespuestaLogin {
  mensaje: string;
  accessToken: string;
  tipoToken: string;
  usuario: { id: number; nombre: string; correo: string; rol: 'USUARIO' | 'ADMINISTRADOR'; activo: boolean };
}

interface RespuestaRegistro {
  mensaje: string;
  usuario: { id: number; nombre: string; correo: string; rol: 'USUARIO' | 'ADMINISTRADOR'; activo: boolean };
}

const TOKEN_KEY = 'fintech_access_token';
const SESSION_KEY = 'fintech_session';
const REMEMBER_EMAIL_KEY = 'fintech_remember_email';

/**
 * Servicio de autenticación conectado al backend real (NestJS) en
 * POST /api/auth/registro, POST /api/auth/login y GET /api/auth/perfil.
 * El token JWT se guarda en localStorage (si "recordar" está activo) o
 * sessionStorage, y se envía automáticamente en cada petición mediante
 * el interceptor HTTP (ver interceptors/auth-interceptor.ts).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly http = inject(HttpClient);

  private readonly _currentUser = signal<AuthUser | null>(null);
  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  constructor() {
    if (this.isBrowser) {
      this.restoreSession();
    }
  }

  /** Token JWT vigente, usado por el interceptor HTTP. */
  getToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
  }

  /** Correo pre-recordado del último login con "Recordarme en este dispositivo" activo. */
  getRememberedEmail(): string {
    if (!this.isBrowser) return '';
    return localStorage.getItem(REMEMBER_EMAIL_KEY) ?? '';
  }

  async login(email: string, password: string, remember: boolean): Promise<AuthResult> {
    try {
      const respuesta = await firstValueFrom(
        this.http.post<RespuestaLogin>(`${API_BASE_URL}/auth/login`, {
          correo: email.trim().toLowerCase(),
          contrasena: password,
        }),
      );

      const authUser: AuthUser = {
        id: respuesta.usuario.id,
        name: respuesta.usuario.nombre,
        email: respuesta.usuario.correo,
        role: respuesta.usuario.rol,
      };

      this.setSession(authUser, respuesta.accessToken, remember);

      if (this.isBrowser) {
        if (remember) {
          localStorage.setItem(REMEMBER_EMAIL_KEY, authUser.email);
        } else {
          localStorage.removeItem(REMEMBER_EMAIL_KEY);
        }
      }

      return { success: true };
    } catch (error) {
      return { success: false, message: mensajeDeError(error, 'Correo o contraseña incorrectos.') };
    }
  }

  async register(name: string, email: string, password: string): Promise<AuthResult> {
    try {
      await firstValueFrom(
        this.http.post<RespuestaRegistro>(`${API_BASE_URL}/auth/registro`, {
          nombre: name.trim(),
          correo: email.trim().toLowerCase(),
          contrasena: password,
        }),
      );

      // El registro no entrega token: inicia sesión automáticamente después.
      return this.login(email, password, true);
    } catch (error) {
      return { success: false, message: mensajeDeError(error, 'No se pudo completar el registro.') };
    }
  }

  async cambiarContrasena(contrasenaActual: string, nuevaContrasena: string): Promise<AuthResult> {
    try {
      await firstValueFrom(
        this.http.post(`${API_BASE_URL}/auth/cambiar-contrasena`, {
          contrasenaActual,
          nuevaContrasena,
        }),
      );
      return { success: true };
    } catch (error) {
      return { success: false, message: mensajeDeError(error, 'No se pudo actualizar la contraseña.') };
    }
  }

  /**
   * El backend todavía no expone un endpoint de recuperación de contraseña
   * (POST /api/auth/*). Se deja la firma para no romper la pantalla de login,
   * pero se informa claramente que la función no está disponible aún.
   */
  async resetPassword(_email: string, _newPassword: string): Promise<AuthResult> {
    return {
      success: false,
      message:
        'La recuperación de contraseña todavía no está disponible: el backend no expone un endpoint para restablecerla. Contacta al administrador para restablecer tu cuenta.',
    };
  }

  logout(): void {
    this._currentUser.set(null);
    if (this.isBrowser) {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    }
  }

  /** Verifica contra el backend que el token guardado siga siendo válido. */
  async verificarSesion(): Promise<boolean> {
    const token = this.getToken();
    if (!token) return false;

    try {
      await firstValueFrom(this.http.get(`${API_BASE_URL}/auth/perfil`));
      return true;
    } catch {
      this.logout();
      return false;
    }
  }

  private setSession(user: AuthUser, token: string, remember: boolean): void {
    this._currentUser.set(user);
    if (!this.isBrowser) return;

    const payload = JSON.stringify(user);
    if (remember) {
      localStorage.setItem(SESSION_KEY, payload);
      localStorage.setItem(TOKEN_KEY, token);
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    } else {
      sessionStorage.setItem(SESSION_KEY, payload);
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  private restoreSession(): void {
    const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
    const token = this.getToken();
    if (!raw || !token) return;
    try {
      this._currentUser.set(JSON.parse(raw) as AuthUser);
    } catch {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    }
  }
}
