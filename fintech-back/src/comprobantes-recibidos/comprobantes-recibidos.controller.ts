import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type { SolicitudAutenticada } from '../auth/interfaces/usuario-autenticado.interface';
import { BloqueadoEnDemo } from '../auth/decorators/bloqueado-en-demo.decorator';
import { ComprobantesRecibidosService } from './comprobantes-recibidos.service';
import { ActualizarCategoriaDetalleDto } from './dto/actualizar-categoria-detalle.dto';
import { FiltrarComprobantesRecibidosDto } from './dto/filtrar-comprobantes-recibidos.dto';
import type { ArchivoComprobanteSubido } from './interfaces/archivo-subido.interface';

@ApiTags('Comprobantes recibidos')
@ApiBearerAuth('access-token')
@BloqueadoEnDemo()
@Controller('comprobantes-recibidos')
export class ComprobantesRecibidosController {
  constructor(
    private readonly comprobantesRecibidosService: ComprobantesRecibidosService,
  ) {}

  @Post('importar')
  @UseInterceptors(
    FilesInterceptor('archivos', 50, {
      limits: { fileSize: 2 * 1024 * 1024, files: 50 },
    }),
  )
  @ApiOperation({
    summary:
      'Importar uno o varios XML de facturas de compra/gasto descargadas del SRI en Línea',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['archivos'],
      properties: {
        archivos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Resumen de la importación' })
  @ApiBadRequestResponse({ description: 'No se adjuntó ningún archivo' })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  importar(
    @Req() solicitud: SolicitudAutenticada,
    @UploadedFiles() archivos: ArchivoComprobanteSubido[] | undefined,
  ) {
    return this.comprobantesRecibidosService.importar(
      solicitud.usuario.sub,
      archivos ?? [],
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Consultar y filtrar los comprobantes recibidos del usuario',
  })
  @ApiOkResponse({ description: 'Lista obtenida correctamente' })
  @ApiBadRequestResponse({ description: 'Uno o varios filtros no son válidos' })
  listar(
    @Req() solicitud: SolicitudAutenticada,
    @Query() filtros: FiltrarComprobantesRecibidosDto,
  ) {
    return this.comprobantesRecibidosService.listarDelUsuario(
      solicitud.usuario.sub,
      filtros,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar un comprobante recibido propio' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Comprobante obtenido correctamente' })
  @ApiNotFoundResponse({
    description: 'El comprobante no existe o no pertenece al usuario',
  })
  obtenerUno(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) comprobanteId: number,
  ) {
    return this.comprobantesRecibidosService.obtenerUno(
      solicitud.usuario.sub,
      comprobanteId,
    );
  }

  @Get(':id/xml')
  @ApiOperation({
    summary: 'Descargar el XML original, íntegro y sin modificar',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiProduces('application/xml')
  async descargarXml(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) comprobanteId: number,
  ) {
    const { xml, nombreArchivo } =
      await this.comprobantesRecibidosService.obtenerXmlOriginal(
        solicitud.usuario.sub,
        comprobanteId,
      );

    return new StreamableFile(xml, {
      type: 'application/xml; charset=utf-8',
      disposition: `attachment; filename="${nombreArchivo}"`,
    });
  }

  @Get(':id/desglose')
  @ApiOperation({
    summary:
      'Desglose de un comprobante: bases IVA por tarifa y distribución del gasto por categoría',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Desglose obtenido correctamente' })
  obtenerDesglose(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) comprobanteId: number,
  ) {
    return this.comprobantesRecibidosService.obtenerDesglose(
      solicitud.usuario.sub,
      comprobanteId,
    );
  }

  @Patch(':id/detalles/:detalleId/categoria')
  @ApiOperation({
    summary:
      'Corregir manualmente la categoría de una línea de un comprobante recibido',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiParam({ name: 'detalleId', type: Number, example: 10 })
  @ApiOkResponse({ description: 'Categoría actualizada correctamente' })
  @ApiBadRequestResponse({ description: 'Los datos enviados no son válidos' })
  @ApiNotFoundResponse({
    description: 'El comprobante, la línea o la categoría no existen',
  })
  actualizarCategoriaDetalle(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) comprobanteId: number,
    @Param('detalleId', ParseIntPipe) detalleId: number,
    @Body() dto: ActualizarCategoriaDetalleDto,
  ) {
    return this.comprobantesRecibidosService.actualizarCategoriaDetalle(
      solicitud.usuario.sub,
      comprobanteId,
      detalleId,
      dto,
    );
  }
}
