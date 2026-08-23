import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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
import { ClientesFacturacionService } from './clientes-facturacion.service';
import { ActualizarClienteDto } from './dto/actualizar-cliente.dto';
import { CrearClienteDto } from './dto/crear-cliente.dto';

@ApiTags('Facturación - Clientes')
@ApiBearerAuth('access-token')
@Controller('facturacion/clientes')
export class ClientesFacturacionController {
  constructor(
    private readonly clientesFacturacionService: ClientesFacturacionService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear un cliente para facturación' })
  @ApiCreatedResponse({ description: 'Cliente creado correctamente' })
  @ApiBadRequestResponse({
    description: 'La identificación o los datos no son válidos',
  })
  @ApiConflictResponse({ description: 'La identificación ya está registrada' })
  @ApiUnauthorizedResponse({ description: 'El token falta o no es válido' })
  crear(
    @Req() solicitud: SolicitudAutenticada,
    @Body() crearClienteDto: CrearClienteDto,
  ) {
    return this.clientesFacturacionService.crear(
      solicitud.usuario.sub,
      crearClienteDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Listar los clientes activos del usuario' })
  @ApiOkResponse({ description: 'Clientes obtenidos correctamente' })
  listar(@Req() solicitud: SolicitudAutenticada) {
    return this.clientesFacturacionService.listar(solicitud.usuario.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar un cliente propio' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Cliente obtenido correctamente' })
  @ApiNotFoundResponse({
    description: 'El cliente no existe o no pertenece al usuario',
  })
  obtenerUno(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) clienteId: number,
  ) {
    return this.clientesFacturacionService.obtenerUno(
      solicitud.usuario.sub,
      clienteId,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un cliente propio' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Cliente actualizado correctamente' })
  @ApiBadRequestResponse({ description: 'Los datos enviados no son válidos' })
  @ApiConflictResponse({ description: 'La identificación ya está registrada' })
  @ApiNotFoundResponse({
    description: 'El cliente no existe o no pertenece al usuario',
  })
  actualizar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) clienteId: number,
    @Body() actualizarClienteDto: ActualizarClienteDto,
  ) {
    return this.clientesFacturacionService.actualizar(
      solicitud.usuario.sub,
      clienteId,
      actualizarClienteDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Desactivar lógicamente un cliente propio' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Cliente desactivado correctamente' })
  @ApiNotFoundResponse({
    description: 'El cliente no existe o ya está desactivado',
  })
  eliminar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) clienteId: number,
  ) {
    return this.clientesFacturacionService.eliminar(
      solicitud.usuario.sub,
      clienteId,
    );
  }
}
