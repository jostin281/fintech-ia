import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { Login } from './login';
import { AuthService } from '../../services/auth';

// Se prueban los formularios reactivos y la lógica pura del componente sin
// disparar el ciclo de vida completo (evita inicializar el canvas animado,
// que depende de APIs del navegador ajenas a lo que queremos validar aquí:
// las reglas de validación que deben coincidir con lo que exige el backend.
describe('Login', () => {
  let component: Login;
  let authServiceMock: {
    login: ReturnType<typeof vi.fn>;
    register: ReturnType<typeof vi.fn>;
    getRememberedEmail: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    authServiceMock = {
      login: vi.fn().mockResolvedValue({ success: true }),
      register: vi.fn().mockResolvedValue({ success: true }),
      getRememberedEmail: vi.fn().mockReturnValue(''),
    };

    TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), { provide: AuthService, useValue: authServiceMock }],
    });

    const fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
  });

  describe('formulario de login', () => {
    it('es inválido vacío y válido con correo y contraseña de al menos 6 caracteres', () => {
      expect(component.loginForm.valid).toBe(false);

      component.loginForm.setValue({ email: 'ana@fintech.ai', password: '123456', remember: true });
      expect(component.loginForm.valid).toBe(true);
    });

    it('rechaza un correo con formato inválido', () => {
      component.loginForm.setValue({ email: 'no-es-un-correo', password: '123456', remember: true });
      expect(component.loginForm.controls.email.valid).toBe(false);
    });

    it('no llama a AuthService.login si el formulario es inválido', async () => {
      component.loginForm.setValue({ email: '', password: '', remember: true });
      await component.onSubmitLogin();
      expect(authServiceMock.login).not.toHaveBeenCalled();
    });
  });

  describe('formulario de registro (debe reflejar las reglas del backend)', () => {
    it('exige contraseña de mínimo 8 caracteres con mayúscula, minúscula, número y símbolo', () => {
      const casosInvalidos = ['corta1!', 'sinmayuscula1!', 'SINMINUSCULA1!', 'SinNumero!', 'SinSimbolo123'];
      for (const clave of casosInvalidos) {
        component.registerForm.controls.password.setValue(clave);
        expect(component.registerForm.controls.password.valid).toBe(false);
      }

      component.registerForm.controls.password.setValue('ClaveSegura123!');
      expect(component.registerForm.controls.password.valid).toBe(true);
    });

    it('marca error de grupo cuando las contraseñas no coinciden', () => {
      component.registerForm.setValue({
        name: 'Ana Torres',
        email: 'ana@fintech.ai',
        password: 'ClaveSegura123!',
        confirmPassword: 'OtraClave123!',
      });

      expect(component.registerForm.errors?.['passwordMismatch']).toBe(true);
      expect(component.registerForm.valid).toBe(false);
    });

    it('es válido cuando todos los campos cumplen las reglas y las contraseñas coinciden', () => {
      component.registerForm.setValue({
        name: 'Ana Torres',
        email: 'ana@fintech.ai',
        password: 'ClaveSegura123!',
        confirmPassword: 'ClaveSegura123!',
      });

      expect(component.registerForm.valid).toBe(true);
    });

    it('no llama a AuthService.register si el formulario es inválido', async () => {
      component.registerForm.controls.email.setValue('correo-invalido');
      await component.onSubmitRegister();
      expect(authServiceMock.register).not.toHaveBeenCalled();
    });
  });

  describe('indicador de fuerza de contraseña', () => {
    it('sube de nivel a medida que la contraseña cumple más reglas', () => {
      component.registerForm.controls.password.setValue('');
      expect(component.passwordStrength()).toBe(0);

      component.registerForm.controls.password.setValue('abcdef');
      expect(component.passwordStrength()).toBeGreaterThanOrEqual(1);

      component.registerForm.controls.password.setValue('ClaveSegura123!');
      expect(component.passwordStrength()).toBe(4);
    });
  });
});
