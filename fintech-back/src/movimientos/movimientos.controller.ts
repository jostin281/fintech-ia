import {
  Body,
  Controller,
  Delete,
  Get,
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
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type { SolicitudAutenticada } from '../auth/interfaces/usuario-autenticado.interface';
import { ActualizarMovimientoDto } from './dto/actualizar-movimiento.dto';
import { CrearMovimientoDto } from './dto/crear-movimiento.dto';
import { FiltrarMovimientosDto } from './dto/filtrar-movimientos.dto';
import { MovimientosService } from './movimientos.service';

@ApiTags('Movimientos')
@ApiBearerAuth('access-token')
@Controller('movimientos')
export class MovimientosController {
  constructor(private readonly movimientosService: MovimientosService) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar un ingreso o gasto',
  })
  @ApiCreatedResponse({
    description: 'Movimiento registrado correctamente',
  })
  @ApiBadRequestResponse({
    description: 'Los datos, la categoría o el tipo no son válidos',
  })
  @ApiNotFoundResponse({
    description: 'La categoría no existe',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  crear(
    @Req() solicitud: SolicitudAutenticada,
    @Body()
    crearMovimientoDto: CrearMovimientoDto,
  ) {
    return this.movimientosService.crear(
      solicitud.usuario.sub,
      crearMovimientoDto,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Consultar y filtrar los movimientos del usuario autenticado',
  })
  @ApiOkResponse({
    description: 'Lista de movimientos obtenida correctamente',
  })
  @ApiBadRequestResponse({
    description: 'Uno o varios filtros no son válidos',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  listar(
    @Req() solicitud: SolicitudAutenticada,
    @Query() filtros: FiltrarMovimientosDto,
  ) {
    return this.movimientosService.listarDelUsuario(
      solicitud.usuario.sub,
      filtros,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consultar un movimiento propio por su identificador',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    example: 1,
    description: 'Identificador del movimiento',
  })
  @ApiOkResponse({
    description: 'Movimiento obtenido correctamente',
  })
  @ApiNotFoundResponse({
    description: 'El movimiento no existe o pertenece a otro usuario',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  obtenerPorId(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe)
    movimientoId: number,
  ) {
    return this.movimientosService.obtenerPorId(
      solicitud.usuario.sub,
      movimientoId,
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar un movimiento propio',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    example: 1,
    description: 'Identificador del movimiento',
  })
  @ApiOkResponse({
    description: 'Movimiento actualizado correctamente',
  })
  @ApiBadRequestResponse({
    description:
      'Los datos enviados o la categoría seleccionada no son válidos',
  })
  @ApiNotFoundResponse({
    description:
      'El movimiento o la categoría no existen, o el movimiento pertenece a otro usuario',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  actualizar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe)
    movimientoId: number,
    @Body()
    actualizarMovimientoDto: ActualizarMovimientoDto,
  ) {
    return this.movimientosService.actualizar(
      solicitud.usuario.sub,
      movimientoId,
      actualizarMovimientoDto,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar lógicamente un movimiento propio',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    example: 1,
    description: 'Identificador del movimiento',
  })
  @ApiOkResponse({
    description: 'Movimiento eliminado correctamente',
  })
  @ApiNotFoundResponse({
    description:
      'El movimiento no existe, pertenece a otro usuario o ya fue eliminado',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  eliminar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe)
    movimientoId: number,
  ) {
    return this.movimientosService.eliminar(
      solicitud.usuario.sub,
      movimientoId,
    );
  }
}
