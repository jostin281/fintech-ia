import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';

import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { DemoService } from './demo.service';
import { Publico } from './decorators/publico.decorator';
import { CambiarContrasenaDto } from './dto/cambiar-contrasena.dto';
import { IniciarSesionDto } from './dto/iniciar-sesion.dto';
import { RegistrarUsuarioDto } from './dto/registrar-usuario.dto';
import type { SolicitudAutenticada } from './interfaces/usuario-autenticado.interface';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly demoService: DemoService,
  ) {}

  // POST /api/auth/registro
  @Publico()
  @Post('registro')
  @ApiOperation({
    summary: 'Registrar un nuevo usuario',
  })
  @ApiCreatedResponse({
    description: 'Usuario registrado correctamente',
  })
  @ApiBadRequestResponse({
    description: 'Los datos enviados no cumplen las validaciones',
  })
  @ApiConflictResponse({
    description: 'Ya existe un usuario con ese correo',
  })
  registrar(
    @Body()
    registrarUsuarioDto: RegistrarUsuarioDto,
  ) {
    return this.authService.registrar(registrarUsuarioDto);
  }

  // POST /api/auth/login
  @Publico()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar sesión y generar un token JWT',
  })
  @ApiOkResponse({
    description: 'Inicio de sesión correcto',
  })
  @ApiBadRequestResponse({
    description: 'Los datos enviados no cumplen las validaciones',
  })
  @ApiUnauthorizedResponse({
    description: 'Correo o contraseña incorrectos',
  })
  @ApiForbiddenResponse({
    description: 'La cuenta está desactivada',
  })
  iniciarSesion(
    @Body()
    iniciarSesionDto: IniciarSesionDto,
  ) {
    return this.authService.iniciarSesion(iniciarSesionDto);
  }

  // POST /api/auth/demo
  // Crea una cuenta temporal con datos de ejemplo, sin pedir credenciales.
  // La cuenta y sus datos se borran solos pasados unos minutos.
  @Publico()
  @Post('demo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Inicia una sesión demo temporal con datos de ejemplo',
  })
  @ApiOkResponse({
    description: 'Sesión demo iniciada',
  })
  iniciarDemo() {
    return this.demoService.crearSesionDemo();
  }

  // GET /api/auth/perfil
  @Get('perfil')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Comprobar el token del usuario autenticado',
  })
  @ApiOkResponse({
    description: 'El token es válido',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  obtenerPerfil(@Req() solicitud: SolicitudAutenticada) {
    return {
      mensaje: 'Token válido',
      usuario: {
        id: solicitud.usuario.sub,
        correo: solicitud.usuario.correo,
        rol: solicitud.usuario.rol,
      },
    };
  }

  // POST /api/auth/cambiar-contrasena
  @Post('cambiar-contrasena')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cambiar la contraseña del usuario autenticado' })
  @ApiOkResponse({ description: 'Contraseña actualizada correctamente' })
  @ApiUnauthorizedResponse({ description: 'La contraseña actual es incorrecta o token inválido' })
  cambiarContrasena(
    @Req() solicitud: SolicitudAutenticada,
    @Body() dto: CambiarContrasenaDto,
  ) {
    return this.authService.cambiarContrasena(solicitud.usuario.sub, dto);
  }
}
