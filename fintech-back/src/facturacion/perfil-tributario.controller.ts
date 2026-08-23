import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type { SolicitudAutenticada } from '../auth/interfaces/usuario-autenticado.interface';
import { ActualizarPerfilTributarioDto } from './dto/actualizar-perfil-tributario.dto';
import { CrearPerfilTributarioDto } from './dto/crear-perfil-tributario.dto';
import { PerfilTributarioService } from './perfil-tributario.service';

@ApiTags('Facturación - Perfil tributario')
@ApiBearerAuth('access-token')
@Controller('facturacion/perfil-tributario')
export class PerfilTributarioController {
  constructor(
    private readonly perfilTributarioService: PerfilTributarioService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear el perfil tributario del usuario' })
  @ApiCreatedResponse({ description: 'Perfil tributario creado correctamente' })
  @ApiBadRequestResponse({
    description: 'Los datos tributarios no son válidos',
  })
  @ApiConflictResponse({
    description: 'El usuario o el RUC ya tiene un perfil',
  })
  @ApiUnauthorizedResponse({ description: 'El token falta o no es válido' })
  crear(
    @Req() solicitud: SolicitudAutenticada,
    @Body() crearPerfilTributarioDto: CrearPerfilTributarioDto,
  ) {
    return this.perfilTributarioService.crear(
      solicitud.usuario.sub,
      crearPerfilTributarioDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Consultar el perfil tributario propio' })
  @ApiOkResponse({ description: 'Perfil tributario obtenido correctamente' })
  @ApiNotFoundResponse({ description: 'El usuario no tiene un perfil activo' })
  @ApiUnauthorizedResponse({ description: 'El token falta o no es válido' })
  obtener(@Req() solicitud: SolicitudAutenticada) {
    return this.perfilTributarioService.obtenerDelUsuario(
      solicitud.usuario.sub,
    );
  }

  @Patch()
  @ApiOperation({
    summary: 'Actualizar los datos permitidos del perfil propio',
  })
  @ApiOkResponse({ description: 'Perfil tributario actualizado correctamente' })
  @ApiBadRequestResponse({ description: 'Los datos enviados no son válidos' })
  @ApiConflictResponse({
    description: 'El cambio entra en conflicto con el RUC o facturas emitidas',
  })
  @ApiNotFoundResponse({ description: 'El usuario no tiene un perfil activo' })
  @ApiUnauthorizedResponse({ description: 'El token falta o no es válido' })
  actualizar(
    @Req() solicitud: SolicitudAutenticada,
    @Body() actualizarPerfilTributarioDto: ActualizarPerfilTributarioDto,
  ) {
    return this.perfilTributarioService.actualizar(
      solicitud.usuario.sub,
      actualizarPerfilTributarioDto,
    );
  }
}
