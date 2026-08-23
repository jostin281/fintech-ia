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
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type { SolicitudAutenticada } from '../auth/interfaces/usuario-autenticado.interface';
import { ActualizarPresupuestoDto } from './dto/actualizar-presupuesto.dto';
import { CrearPresupuestoDto } from './dto/crear-presupuesto.dto';
import { FiltrarPresupuestosDto } from './dto/filtrar-presupuestos.dto';
import { PresupuestosService } from './presupuestos.service';

@ApiTags('Presupuestos')
@ApiBearerAuth('access-token')
@Controller('presupuestos')
export class PresupuestosController {
  constructor(private readonly presupuestosService: PresupuestosService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear un presupuesto mensual para una categoría de gasto',
  })
  @ApiCreatedResponse({
    description: 'Presupuesto creado correctamente',
  })
  @ApiBadRequestResponse({
    description:
      'Los datos, el periodo o la categoría seleccionada no son válidos',
  })
  @ApiNotFoundResponse({
    description: 'La categoría seleccionada no existe',
  })
  @ApiConflictResponse({
    description:
      'Ya existe un presupuesto activo para la categoría y periodo seleccionados',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  crear(
    @Req() solicitud: SolicitudAutenticada,
    @Body()
    crearPresupuestoDto: CrearPresupuestoDto,
  ) {
    return this.presupuestosService.crear(
      solicitud.usuario.sub,
      crearPresupuestoDto,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Consultar los presupuestos y su consumo mensual',
  })
  @ApiOkResponse({
    description: 'Presupuestos obtenidos correctamente',
  })
  @ApiBadRequestResponse({
    description: 'El mes, el año o la combinación de filtros no son válidos',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  listar(
    @Req() solicitud: SolicitudAutenticada,
    @Query()
    filtros: FiltrarPresupuestosDto,
  ) {
    return this.presupuestosService.listarDelUsuario(
      solicitud.usuario.sub,
      filtros,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consultar individualmente un presupuesto propio',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador del presupuesto',
    example: 1,
    type: Number,
  })
  @ApiOkResponse({
    description: 'Presupuesto obtenido correctamente',
  })
  @ApiBadRequestResponse({
    description: 'El identificador del presupuesto no es válido',
  })
  @ApiNotFoundResponse({
    description:
      'El presupuesto no existe, está desactivado o pertenece a otro usuario',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  obtenerUno(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe)
    presupuestoId: number,
  ) {
    return this.presupuestosService.obtenerUnoDelUsuario(
      solicitud.usuario.sub,
      presupuestoId,
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Actualizar el monto o porcentaje de alerta de un presupuesto propio',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador del presupuesto',
    example: 1,
    type: Number,
  })
  @ApiOkResponse({
    description: 'Presupuesto actualizado correctamente',
  })
  @ApiBadRequestResponse({
    description: 'El identificador o los datos enviados no son válidos',
  })
  @ApiNotFoundResponse({
    description:
      'El presupuesto no existe, está desactivado o pertenece a otro usuario',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  actualizar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe)
    presupuestoId: number,
    @Body()
    actualizarPresupuestoDto: ActualizarPresupuestoDto,
  ) {
    return this.presupuestosService.actualizar(
      solicitud.usuario.sub,
      presupuestoId,
      actualizarPresupuestoDto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar lógicamente un presupuesto propio',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador del presupuesto',
    example: 1,
    type: Number,
  })
  @ApiOkResponse({
    description: 'Presupuesto eliminado correctamente',
  })
  @ApiBadRequestResponse({
    description: 'El identificador del presupuesto no es válido',
  })
  @ApiNotFoundResponse({
    description:
      'El presupuesto no existe, ya está desactivado o pertenece a otro usuario',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  eliminar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe)
    presupuestoId: number,
  ) {
    return this.presupuestosService.eliminar(
      solicitud.usuario.sub,
      presupuestoId,
    );
  }
}
