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
} from '@nestjs/swagger';

import type { SolicitudAutenticada } from '../auth/interfaces/usuario-autenticado.interface';
import { ActualizarProductoServicioDto } from './dto/actualizar-producto-servicio.dto';
import { CrearProductoServicioDto } from './dto/crear-producto-servicio.dto';
import { ProductosServiciosService } from './productos-servicios.service';

@ApiTags('Facturación - Productos y servicios')
@ApiBearerAuth('access-token')
@Controller('facturacion/productos-servicios')
export class ProductosServiciosController {
  constructor(
    private readonly productosServiciosService: ProductosServiciosService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear un producto o servicio facturable' })
  @ApiCreatedResponse({
    description: 'Producto o servicio creado correctamente',
  })
  @ApiBadRequestResponse({ description: 'Los datos enviados no son válidos' })
  @ApiConflictResponse({
    description: 'El código principal ya está registrado',
  })
  crear(
    @Req() solicitud: SolicitudAutenticada,
    @Body() crearProductoServicioDto: CrearProductoServicioDto,
  ) {
    return this.productosServiciosService.crear(
      solicitud.usuario.sub,
      crearProductoServicioDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Listar productos y servicios activos' })
  @ApiOkResponse({
    description: 'Productos y servicios obtenidos correctamente',
  })
  listar(@Req() solicitud: SolicitudAutenticada) {
    return this.productosServiciosService.listar(solicitud.usuario.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar un producto o servicio propio' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiNotFoundResponse({ description: 'El producto o servicio no existe' })
  obtenerUno(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) productoServicioId: number,
  ) {
    return this.productosServiciosService.obtenerUno(
      solicitud.usuario.sub,
      productoServicioId,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un producto o servicio propio' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({
    description: 'Producto o servicio actualizado correctamente',
  })
  @ApiBadRequestResponse({ description: 'Los datos enviados no son válidos' })
  @ApiConflictResponse({
    description: 'El código principal ya está registrado',
  })
  @ApiNotFoundResponse({ description: 'El producto o servicio no existe' })
  actualizar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) productoServicioId: number,
    @Body() actualizarProductoServicioDto: ActualizarProductoServicioDto,
  ) {
    return this.productosServiciosService.actualizar(
      solicitud.usuario.sub,
      productoServicioId,
      actualizarProductoServicioDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Desactivar un producto o servicio propio' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({
    description: 'Producto o servicio desactivado correctamente',
  })
  @ApiNotFoundResponse({ description: 'El producto o servicio no existe' })
  eliminar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) productoServicioId: number,
  ) {
    return this.productosServiciosService.eliminar(
      solicitud.usuario.sub,
      productoServicioId,
    );
  }
}
