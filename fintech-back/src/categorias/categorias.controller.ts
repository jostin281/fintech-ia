import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';

import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiBearerAuth,
  ApiForbiddenResponse,
} from '@nestjs/swagger';

import { CategoriasService } from './categorias.service';
import { ActualizarCategoriaDto } from './dto/actualizar-categoria.dto';
import { ActualizarEstadoCategoriaDto } from './dto/actualizar-estado-categoria.dto';
import { CrearCategoriaDto } from './dto/crear-categoria.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Categorías')
@ApiBearerAuth('access-token')
@Controller('categorias')
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  // GET /api/categorias
  @Get()
  @ApiOperation({
    summary: 'Consultar todas las categorías',
  })
  @ApiOkResponse({
    description: 'Categorías obtenidas correctamente',
  })
  obtenerTodas() {
    return this.categoriasService.obtenerTodas();
  }

  // GET /api/categorias/1
  @Get(':id')
  @ApiOperation({
    summary: 'Consultar una categoría mediante su identificador',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador numérico de la categoría',
    example: 1,
    type: Number,
  })
  @ApiOkResponse({
    description: 'Categoría obtenida correctamente',
  })
  @ApiBadRequestResponse({
    description: 'El identificador debe ser un número entero',
  })
  @ApiNotFoundResponse({
    description: 'No existe una categoría con ese identificador',
  })
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.categoriasService.obtenerPorId(id);
  }

  // POST /api/categorias
  @Post()
  @Roles('ADMINISTRADOR')
  @ApiForbiddenResponse({
    description: 'El usuario no tiene permisos de administrador',
  })
  @ApiOperation({
    summary: 'Crear una nueva categoría',
  })
  @ApiCreatedResponse({
    description: 'Categoría creada correctamente',
  })
  @ApiBadRequestResponse({
    description: 'Los datos enviados no cumplen las validaciones',
  })
  @ApiConflictResponse({
    description: 'Ya existe una categoría con el mismo nombre y tipo',
  })
  crear(@Body() crearCategoriaDto: CrearCategoriaDto) {
    return this.categoriasService.crear(crearCategoriaDto);
  }

  // PATCH /api/categorias/1/estado
  @Patch(':id/estado')
  @Roles('ADMINISTRADOR')
  @ApiForbiddenResponse({
    description: 'El usuario no tiene permisos de administrador',
  })
  @ApiOperation({
    summary: 'Activar o desactivar una categoría',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador numérico de la categoría',
    example: 1,
    type: Number,
  })
  @ApiOkResponse({
    description: 'Estado de la categoría actualizado correctamente',
  })
  @ApiBadRequestResponse({
    description: 'El identificador o el estado son incorrectos',
  })
  @ApiNotFoundResponse({
    description: 'No existe una categoría con ese identificador',
  })
  actualizarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() actualizarEstadoDto: ActualizarEstadoCategoriaDto,
  ) {
    return this.categoriasService.actualizarEstado(id, actualizarEstadoDto);
  }

  // PATCH /api/categorias/1
  @Patch(':id')
  @Roles('ADMINISTRADOR')
  @ApiForbiddenResponse({
    description: 'El usuario no tiene permisos de administrador',
  })
  @ApiOperation({
    summary: 'Actualizar parcialmente una categoría',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador numérico de la categoría',
    example: 1,
    type: Number,
  })
  @ApiOkResponse({
    description: 'Categoría actualizada correctamente',
  })
  @ApiBadRequestResponse({
    description: 'El identificador o los datos son incorrectos',
  })
  @ApiNotFoundResponse({
    description: 'No existe una categoría con ese identificador',
  })
  @ApiConflictResponse({
    description: 'La actualización produciría una categoría repetida',
  })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() actualizarCategoriaDto: ActualizarCategoriaDto,
  ) {
    return this.categoriasService.actualizar(id, actualizarCategoriaDto);
  }
}
