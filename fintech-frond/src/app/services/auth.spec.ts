import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AuthService } from './auth';
import { API_BASE_URL } from './api-config';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('empieza sin sesión iniciada', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
  });

  it('inicia sesión, guarda el usuario y el token, y normaliza el correo a minúsculas', async () => {
    const loginPromise = service.login('Ana@Fintech.ai', 'ClaveSegura123!', true);

    const peticion = httpMock.expectOne(`${API_BASE_URL}/auth/login`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      correo: 'ana@fintech.ai',
      contrasena: 'ClaveSegura123!',
    });

    peticion.flush({
      mensaje: 'Inicio de sesión correcto',
      accessToken: 'token-de-prueba',
      tipoToken: 'Bearer',
      usuario: { id: 1, nombre: 'Ana', correo: 'ana@fintech.ai', rol: 'USUARIO', activo: true },
    });

    const resultado = await loginPromise;

    expect(resultado.success).toBe(true);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUser()).toEqual({ id: 1, name: 'Ana', email: 'ana@fintech.ai', role: 'USUARIO' });
    expect(service.getToken()).toBe('token-de-prueba');
    // "remember" = true → se guarda en localStorage, no en sessionStorage.
    expect(localStorage.getItem('fintech_access_token')).toBe('token-de-prueba');
    expect(sessionStorage.getItem('fintech_access_token')).toBeNull();
    expect(service.getRememberedEmail()).toBe('ana@fintech.ai');
  });

  it('guarda la sesión solo en sessionStorage cuando "recordarme" está desactivado', async () => {
    const loginPromise = service.login('ana@fintech.ai', 'clave', false);
    httpMock.expectOne(`${API_BASE_URL}/auth/login`).flush({
      mensaje: 'ok',
      accessToken: 'token-temporal',
      tipoToken: 'Bearer',
      usuario: { id: 1, nombre: 'Ana', correo: 'ana@fintech.ai', rol: 'USUARIO', activo: true },
    });
    await loginPromise;

    expect(sessionStorage.getItem('fintech_access_token')).toBe('token-temporal');
    expect(localStorage.getItem('fintech_access_token')).toBeNull();
  });

  it('devuelve un mensaje de error y no autentica cuando el backend rechaza las credenciales', async () => {
    const loginPromise = service.login('ana@fintech.ai', 'incorrecta', true);

    httpMock
      .expectOne(`${API_BASE_URL}/auth/login`)
      .flush({ message: 'Correo o contraseña incorrectos' }, { status: 401, statusText: 'Unauthorized' });

    const resultado = await loginPromise;

    expect(resultado.success).toBe(false);
    expect(resultado.message).toBe('Correo o contraseña incorrectos');
    expect(service.isAuthenticated()).toBe(false);
    expect(service.getToken()).toBeNull();
  });

  it('logout limpia la sesión y ambos almacenamientos', async () => {
    const loginPromise = service.login('ana@fintech.ai', 'clave', true);
    httpMock.expectOne(`${API_BASE_URL}/auth/login`).flush({
      mensaje: 'ok',
      accessToken: 'token-de-prueba',
      tipoToken: 'Bearer',
      usuario: { id: 1, nombre: 'Ana', correo: 'ana@fintech.ai', rol: 'USUARIO', activo: true },
    });
    await loginPromise;

    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(localStorage.getItem('fintech_access_token')).toBeNull();
    expect(sessionStorage.getItem('fintech_access_token')).toBeNull();
  });

  it('resetPassword informa que la función todavía no está disponible en el backend', async () => {
    const resultado = await service.resetPassword('ana@fintech.ai', 'nueva-clave');

    expect(resultado.success).toBe(false);
    expect(resultado.message).toContain('no está disponible');
  });
});
