import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { UsuariosService } from '../usuarios/usuarios.service';

// Estas pruebas cubren la lógica de seguridad más sensible del backend:
// que nunca se revele si un correo existe, que las contraseñas siempre se
// verifiquen con bcrypt (nunca en texto plano) y que una cuenta desactivada
// no pueda iniciar sesión aunque la contraseña sea correcta.
describe('AuthService', () => {
  let authService: AuthService;
  let usuariosService: { buscarPorCorreo: jest.Mock; crear: jest.Mock };
  let jwtService: JwtService;

  const CONTRASENA_VALIDA = 'ClaveSegura123!';

  beforeEach(async () => {
    usuariosService = {
      buscarPorCorreo: jest.fn(),
      crear: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'clave-de-prueba', signOptions: { expiresIn: '1h' } })],
      providers: [AuthService, { provide: UsuariosService, useValue: usuariosService }],
    }).compile();

    authService = module.get(AuthService);
    jwtService = module.get(JwtService);
  });

  describe('registrar', () => {
    it('rechaza el registro si ya existe un usuario con ese correo', async () => {
      usuariosService.buscarPorCorreo.mockResolvedValue({ id: 1, correo: 'ana@fintech.ai' });

      await expect(
        authService.registrar({
          nombre: 'Ana',
          correo: 'ANA@fintech.ai',
          contrasena: CONTRASENA_VALIDA,
        }),
      ).rejects.toThrow(ConflictException);

      expect(usuariosService.crear).not.toHaveBeenCalled();
    });

    it('normaliza el correo a minúsculas y guarda la contraseña cifrada (nunca en texto plano)', async () => {
      usuariosService.buscarPorCorreo.mockResolvedValue(null);
      usuariosService.crear.mockImplementation(async (datos) => ({
        id: 1,
        nombre: datos.nombre,
        correo: datos.correo,
        rol: 'USUARIO',
        activo: true,
      }));

      await authService.registrar({
        nombre: '  Ana   Torres  ',
        correo: 'ANA@Fintech.ai',
        contrasena: CONTRASENA_VALIDA,
      });

      expect(usuariosService.buscarPorCorreo).toHaveBeenCalledWith('ana@fintech.ai');

      const datosGuardados = usuariosService.crear.mock.calls[0][0];
      expect(datosGuardados.correo).toBe('ana@fintech.ai');
      expect(datosGuardados.nombre).toBe('Ana Torres');
      expect(datosGuardados.contrasenaHash).not.toBe(CONTRASENA_VALIDA);
      await expect(bcrypt.compare(CONTRASENA_VALIDA, datosGuardados.contrasenaHash)).resolves.toBe(true);
    });
  });

  describe('iniciarSesion', () => {
    async function crearUsuarioSimulado(overrides: Partial<Record<string, unknown>> = {}) {
      return {
        id: 7,
        nombre: 'Ana Torres',
        correo: 'ana@fintech.ai',
        contrasenaHash: await bcrypt.hash(CONTRASENA_VALIDA, 10),
        rol: 'USUARIO',
        activo: true,
        ...overrides,
      };
    }

    it('usa el mismo mensaje de error para correo inexistente y contraseña incorrecta (no revela cuál falló)', async () => {
      usuariosService.buscarPorCorreo.mockResolvedValue(null);

      await expect(
        authService.iniciarSesion({ correo: 'nadie@fintech.ai', contrasena: 'lo-que-sea' }),
      ).rejects.toThrow(new UnauthorizedException('Correo o contraseña incorrectos'));
    });

    it('rechaza una contraseña incorrecta', async () => {
      usuariosService.buscarPorCorreo.mockResolvedValue(await crearUsuarioSimulado());

      await expect(
        authService.iniciarSesion({ correo: 'ana@fintech.ai', contrasena: 'contrasena-incorrecta' }),
      ).rejects.toThrow(new UnauthorizedException('Correo o contraseña incorrectos'));
    });

    it('rechaza el acceso de una cuenta desactivada aunque la contraseña sea correcta', async () => {
      usuariosService.buscarPorCorreo.mockResolvedValue(await crearUsuarioSimulado({ activo: false }));

      await expect(
        authService.iniciarSesion({ correo: 'ana@fintech.ai', contrasena: CONTRASENA_VALIDA }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('genera un accessToken JWT válido con el id, correo y rol del usuario', async () => {
      usuariosService.buscarPorCorreo.mockResolvedValue(await crearUsuarioSimulado());

      const resultado = await authService.iniciarSesion({
        correo: 'ana@fintech.ai',
        contrasena: CONTRASENA_VALIDA,
      });

      expect(resultado.tipoToken).toBe('Bearer');
      expect(resultado.usuario).toEqual({
        id: 7,
        nombre: 'Ana Torres',
        correo: 'ana@fintech.ai',
        rol: 'USUARIO',
        activo: true,
      });
      // La contraseña (ni su hash) nunca debe viajar de vuelta al cliente.
      expect(resultado.usuario).not.toHaveProperty('contrasenaHash');

      const payload = await jwtService.verifyAsync(resultado.accessToken);
      expect(payload).toMatchObject({ sub: 7, correo: 'ana@fintech.ai', rol: 'USUARIO' });
    });
  });
});
