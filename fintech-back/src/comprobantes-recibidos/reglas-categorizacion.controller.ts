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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import type { SolicitudAutenticada } from '../auth/interfaces/usuario-autenticado.interface';
import { BloqueadoEnDemo } from '../auth/decorators/bloqueado-en-demo.decorator';
import { ActualizarReglaCategorizacionDto } from './dto/actualizar-regla-categorizacion.dto';
import { CrearReglaCategorizacionDto } from './dto/crear-regla-categorizacion.dto';
import { FiltrarReglasCategorizacionDto } from './dto/filtrar-reglas-categorizacion.dto';
import { ReglasCategorizacionService } from './reglas-categorizacion.service';

@ApiTags('Comprobantes recibidos - Reglas de categorización')
@ApiBearerAuth('access-token')
@BloqueadoEnDemo()
@Controller('comprobantes-recibidos/reglas')
export class ReglasCategorizacionController {
  constructor(
    private readonly reglasCategorizacionService: ReglasCategorizacionService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Listar las reglas de categorización visibles (globales y personales del usuario)',
  })
  @ApiOkResponse({ description: 'Lista obtenida correctamente' })
  listar(
    @Req() solicitud: SolicitudAutenticada,
    @Query() filtros: FiltrarReglasCategorizacionDto,
  ) {
    return this.reglasCategorizacionService.listar(
      solicitud.usuario.sub,
      filtros,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Crear una regla de categorización' })
  @ApiOkResponse({ description: 'Regla creada correctamente' })
  @ApiBadRequestResponse({ description: 'Los datos enviados no son válidos' })
  @ApiForbiddenResponse({
    description: 'Solo un administrador puede crear reglas globales',
  })
  crear(
    @Req() solicitud: SolicitudAutenticada,
    @Body() dto: CrearReglaCategorizacionDto,
  ) {
    return this.reglasCategorizacionService.crear(
      solicitud.usuario.sub,
      solicitud.usuario.rol,
      dto,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una regla de categorización propia' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Regla actualizada correctamente' })
  @ApiNotFoundResponse({ description: 'La regla no existe' })
  @ApiForbiddenResponse({ description: 'No tiene permisos sobre esta regla' })
  actualizar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) reglaId: number,
    @Body() dto: ActualizarReglaCategorizacionDto,
  ) {
    return this.reglasCategorizacionService.actualizar(
      solicitud.usuario.sub,
      solicitud.usuario.rol,
      reglaId,
      dto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una regla de categorización propia' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Regla eliminada correctamente' })
  @ApiNotFoundResponse({ description: 'La regla no existe' })
  @ApiForbiddenResponse({ description: 'No tiene permisos sobre esta regla' })
  eliminar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) reglaId: number,
  ) {
    return this.reglasCategorizacionService.eliminar(
      solicitud.usuario.sub,
      solicitud.usuario.rol,
      reglaId,
    );
  }
}
