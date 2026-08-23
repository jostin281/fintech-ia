import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type { SolicitudAutenticada } from '../auth/interfaces/usuario-autenticado.interface';
import { ActualizarClaveGeminiDto } from './dto/actualizar-clave-gemini.dto';
import { UsuariosService } from './usuarios.service';

@ApiTags('Usuarios')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  // GET /api/usuarios/clave-gemini
  @Get('clave-gemini')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Obtener la clave personal de Gemini del usuario autenticado',
  })
  @ApiOkResponse({ description: 'Clave de Gemini (o null si no está configurada)' })
  @ApiUnauthorizedResponse({ description: 'El token falta, es inválido o ha expirado' })
  obtenerClaveGemini(@Req() solicitud: SolicitudAutenticada) {
    return this.usuariosService.obtenerClaveGemini(solicitud.usuario.sub);
  }

  // PATCH /api/usuarios/clave-gemini
  @Patch('clave-gemini')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Guardar, actualizar o eliminar la clave personal de Gemini',
  })
  @ApiOkResponse({ description: 'Clave de Gemini actualizada correctamente' })
  @ApiUnauthorizedResponse({ description: 'El token falta, es inválido o ha expirado' })
  actualizarClaveGemini(
    @Req() solicitud: SolicitudAutenticada,
    @Body() actualizarClaveGeminiDto: ActualizarClaveGeminiDto,
  ) {
    return this.usuariosService.actualizarClaveGemini(
      solicitud.usuario.sub,
      actualizarClaveGeminiDto.geminiApiKey,
    );
  }
}
