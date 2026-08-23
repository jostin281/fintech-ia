import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type { SolicitudAutenticada } from '../auth/interfaces/usuario-autenticado.interface';
import { ActualizarMetaAhorroDto } from './dto/actualizar-meta-ahorro.dto';
import { CrearAporteMetaDto } from './dto/crear-aporte-meta.dto';
import { CrearMetaAhorroDto } from './dto/crear-meta-ahorro.dto';
import { MetasAhorroService } from './metas-ahorro.service';

@ApiTags('Metas de ahorro')
@ApiBearerAuth('access-token')
@Controller('metas-ahorro')
export class MetasAhorroController {
  constructor(private readonly metasAhorroService: MetasAhorroService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear una meta de ahorro para el usuario autenticado',
  })
  @ApiCreatedResponse({
    description: 'Meta de ahorro creada correctamente',
  })
  @ApiBadRequestResponse({
    description: 'Los datos o la fecha objetivo no son válidos',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  crear(
    @Req() solicitud: SolicitudAutenticada,
    @Body()
    crearMetaAhorroDto: CrearMetaAhorroDto,
  ) {
    return this.metasAhorroService.crear(
      solicitud.usuario.sub,
      crearMetaAhorroDto,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Consultar las metas activas y su progreso',
  })
  @ApiOkResponse({
    description: 'Metas de ahorro obtenidas correctamente',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  listar(@Req() solicitud: SolicitudAutenticada) {
    return this.metasAhorroService.listarDelUsuario(solicitud.usuario.sub);
  }

  @Post(':id/aportes')
  @ApiOperation({
    summary: 'Registrar un aporte en una meta de ahorro propia',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la meta de ahorro',
    example: 1,
    type: Number,
  })
  @ApiCreatedResponse({
    description: 'Aporte registrado correctamente',
  })
  @ApiBadRequestResponse({
    description: 'El identificador o el monto del aporte no son válidos',
  })
  @ApiNotFoundResponse({
    description:
      'La meta no existe, está desactivada o pertenece a otro usuario',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  registrarAporte(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe)
    metaAhorroId: number,
    @Body()
    crearAporteMetaDto: CrearAporteMetaDto,
  ) {
    return this.metasAhorroService.registrarAporte(
      solicitud.usuario.sub,
      metaAhorroId,
      crearAporteMetaDto,
    );
  }

  @Get(':id/aportes')
  @ApiOperation({
    summary: 'Consultar el historial de aportes activos de una meta propia',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la meta de ahorro',
    example: 1,
    type: Number,
  })
  @ApiOkResponse({
    description: 'Aportes obtenidos correctamente',
  })
  @ApiBadRequestResponse({
    description: 'El identificador de la meta no es válido',
  })
  @ApiNotFoundResponse({
    description:
      'La meta no existe, está desactivada o pertenece a otro usuario',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  listarAportes(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe)
    metaAhorroId: number,
  ) {
    return this.metasAhorroService.listarAportes(
      solicitud.usuario.sub,
      metaAhorroId,
    );
  }

  @Delete(':metaId/aportes/:aporteId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar lógicamente un aporte de una meta propia',
  })
  @ApiParam({
    name: 'metaId',
    description: 'Identificador de la meta de ahorro',
    example: 1,
    type: Number,
  })
  @ApiParam({
    name: 'aporteId',
    description: 'Identificador del aporte',
    example: 1,
    type: Number,
  })
  @ApiOkResponse({
    description: 'Aporte eliminado correctamente',
  })
  @ApiBadRequestResponse({
    description: 'Uno de los identificadores no es válido',
  })
  @ApiNotFoundResponse({
    description:
      'La meta o el aporte no existen, están desactivados o no corresponden al usuario',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  eliminarAporte(
    @Req() solicitud: SolicitudAutenticada,
    @Param('metaId', ParseIntPipe)
    metaAhorroId: number,
    @Param('aporteId', ParseIntPipe)
    aporteId: number,
  ) {
    return this.metasAhorroService.eliminarAporte(
      solicitud.usuario.sub,
      metaAhorroId,
      aporteId,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consultar una meta de ahorro propia por su identificador',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la meta de ahorro',
    example: 1,
    type: Number,
  })
  @ApiOkResponse({
    description: 'Meta de ahorro obtenida correctamente',
  })
  @ApiBadRequestResponse({
    description: 'El identificador de la meta no es válido',
  })
  @ApiNotFoundResponse({
    description:
      'La meta no existe, está desactivada o pertenece a otro usuario',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  obtenerUna(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe)
    metaAhorroId: number,
  ) {
    return this.metasAhorroService.obtenerUnaDelUsuario(
      solicitud.usuario.sub,
      metaAhorroId,
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar una meta de ahorro propia',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la meta de ahorro',
    example: 1,
    type: Number,
  })
  @ApiOkResponse({
    description: 'Meta de ahorro actualizada correctamente',
  })
  @ApiBadRequestResponse({
    description: 'El identificador o los datos enviados no son válidos',
  })
  @ApiNotFoundResponse({
    description:
      'La meta no existe, está desactivada o pertenece a otro usuario',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  actualizar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe)
    metaAhorroId: number,
    @Body()
    actualizarMetaAhorroDto: ActualizarMetaAhorroDto,
  ) {
    return this.metasAhorroService.actualizar(
      solicitud.usuario.sub,
      metaAhorroId,
      actualizarMetaAhorroDto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar lógicamente una meta de ahorro propia',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la meta de ahorro',
    example: 1,
    type: Number,
  })
  @ApiOkResponse({
    description: 'Meta de ahorro eliminada correctamente',
  })
  @ApiBadRequestResponse({
    description: 'El identificador de la meta no es válido',
  })
  @ApiNotFoundResponse({
    description:
      'La meta no existe, ya está desactivada o pertenece a otro usuario',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  eliminar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe)
    metaAhorroId: number,
  ) {
    return this.metasAhorroService.eliminar(
      solicitud.usuario.sub,
      metaAhorroId,
    );
  }
}
