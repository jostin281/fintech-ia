import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
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
import { BloqueadoEnDemo } from '../auth/decorators/bloqueado-en-demo.decorator';
import { CrearRetencionRecibidaDto } from './dto/crear-retencion-recibida.dto';
import { RetencionesRecibidasService } from './retenciones-recibidas.service';

@ApiTags('Facturación - Retenciones recibidas')
@ApiBearerAuth('access-token')
@BloqueadoEnDemo()
@Controller('facturacion/retenciones-recibidas')
export class RetencionesRecibidasController {
  constructor(
    private readonly retencionesRecibidasService: RetencionesRecibidasService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Registrar una retención entregada por un cliente' })
  @ApiCreatedResponse({ description: 'Retención registrada correctamente' })
  @ApiBadRequestResponse({
    description: 'El cálculo o los datos no son válidos',
  })
  @ApiConflictResponse({ description: 'El comprobante de retención ya existe' })
  @ApiNotFoundResponse({ description: 'La factura asociada no existe' })
  crear(
    @Req() solicitud: SolicitudAutenticada,
    @Body() crearRetencionRecibidaDto: CrearRetencionRecibidaDto,
  ) {
    return this.retencionesRecibidasService.crear(
      solicitud.usuario.sub,
      crearRetencionRecibidaDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Listar las retenciones recibidas activas' })
  @ApiOkResponse({ description: 'Retenciones obtenidas correctamente' })
  listar(@Req() solicitud: SolicitudAutenticada) {
    return this.retencionesRecibidasService.listar(solicitud.usuario.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Desactivar una retención registrada por error' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Retención desactivada correctamente' })
  @ApiNotFoundResponse({ description: 'La retención no existe' })
  eliminar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) retencionId: number,
  ) {
    return this.retencionesRecibidasService.eliminar(
      solicitud.usuario.sub,
      retencionId,
    );
  }
}
