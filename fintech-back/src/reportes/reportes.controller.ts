import { Controller, Get, Query, Req, StreamableFile } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type { SolicitudAutenticada } from '../auth/interfaces/usuario-autenticado.interface';
import { ConsultarReporteDto } from './dto/consultar-reporte.dto';
import { ExportarReporteDto } from './dto/exportar-reporte.dto';
import { ReportesExportacionService } from './reportes-exportacion.service';
import { ReportesService, type TipoReporte } from './reportes.service';

@ApiTags('Reportes')
@ApiBearerAuth('access-token')
@Controller('reportes')
export class ReportesController {
  constructor(
    private readonly reportesService: ReportesService,
    private readonly reportesExportacionService: ReportesExportacionService,
  ) {}

  @Get('diario')
  @ApiOperation({
    summary: 'Obtener el reporte diario del usuario autenticado',
  })
  @ApiOkResponse({
    description: 'Reporte diario obtenido correctamente',
  })
  @ApiBadRequestResponse({
    description: 'La fecha de referencia no es válida',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  obtenerDiario(
    @Req() solicitud: SolicitudAutenticada,
    @Query() consulta: ConsultarReporteDto,
  ) {
    return this.reportesService.obtenerReporte(
      solicitud.usuario.sub,
      'DIARIO',
      consulta.fechaReferencia,
    );
  }

  @Get('semanal')
  @ApiOperation({
    summary: 'Obtener el reporte semanal del usuario autenticado',
  })
  @ApiOkResponse({
    description: 'Reporte semanal obtenido correctamente',
  })
  @ApiBadRequestResponse({
    description: 'La fecha de referencia no es válida',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  obtenerSemanal(
    @Req() solicitud: SolicitudAutenticada,
    @Query()
    consulta: ConsultarReporteDto,
  ) {
    return this.reportesService.obtenerReporte(
      solicitud.usuario.sub,
      'SEMANAL',
      consulta.fechaReferencia,
    );
  }

  @Get('mensual')
  @ApiOperation({
    summary: 'Obtener el reporte mensual del usuario autenticado',
  })
  @ApiOkResponse({
    description: 'Reporte mensual obtenido correctamente',
  })
  @ApiBadRequestResponse({
    description: 'La fecha de referencia no es válida',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  obtenerMensual(
    @Req() solicitud: SolicitudAutenticada,
    @Query()
    consulta: ConsultarReporteDto,
  ) {
    return this.reportesService.obtenerReporte(
      solicitud.usuario.sub,
      'MENSUAL',
      consulta.fechaReferencia,
    );
  }

  @Get('anual')
  @ApiOperation({
    summary: 'Obtener el reporte anual del usuario autenticado',
  })
  @ApiOkResponse({
    description: 'Reporte anual obtenido correctamente',
  })
  @ApiBadRequestResponse({
    description: 'La fecha de referencia no es válida',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  obtenerAnual(
    @Req() solicitud: SolicitudAutenticada,
    @Query()
    consulta: ConsultarReporteDto,
  ) {
    return this.reportesService.obtenerReporte(
      solicitud.usuario.sub,
      'ANUAL',
      consulta.fechaReferencia,
    );
  }

  @Get('diario/exportar')
  @ApiOperation({
    summary: 'Exportar el reporte diario en PDF o Excel',
  })
  @ApiProduces(
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiOkResponse({
    description: 'Archivo generado correctamente',
    schema: {
      type: 'string',
      format: 'binary',
    },
  })
  @ApiBadRequestResponse({
    description: 'La fecha o el formato no son válidos',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  exportarDiario(
    @Req() solicitud: SolicitudAutenticada,
    @Query() exportarReporteDto: ExportarReporteDto,
  ): Promise<StreamableFile> {
    return this.exportar(solicitud.usuario.sub, 'DIARIO', exportarReporteDto);
  }

  @Get('semanal/exportar')
  @ApiOperation({
    summary: 'Exportar el reporte semanal en PDF o Excel',
  })
  @ApiProduces(
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiOkResponse({
    description: 'Archivo generado correctamente',
    schema: {
      type: 'string',
      format: 'binary',
    },
  })
  @ApiBadRequestResponse({
    description: 'La fecha o el formato no son válidos',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  exportarSemanal(
    @Req() solicitud: SolicitudAutenticada,
    @Query()
    exportarReporteDto: ExportarReporteDto,
  ): Promise<StreamableFile> {
    return this.exportar(solicitud.usuario.sub, 'SEMANAL', exportarReporteDto);
  }

  @Get('mensual/exportar')
  @ApiOperation({
    summary: 'Exportar el reporte mensual en PDF o Excel',
  })
  @ApiProduces(
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiOkResponse({
    description: 'Archivo generado correctamente',
    schema: {
      type: 'string',
      format: 'binary',
    },
  })
  @ApiBadRequestResponse({
    description: 'La fecha o el formato no son válidos',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  exportarMensual(
    @Req() solicitud: SolicitudAutenticada,
    @Query()
    exportarReporteDto: ExportarReporteDto,
  ): Promise<StreamableFile> {
    return this.exportar(solicitud.usuario.sub, 'MENSUAL', exportarReporteDto);
  }

  @Get('anual/exportar')
  @ApiOperation({
    summary: 'Exportar el reporte anual en PDF o Excel',
  })
  @ApiProduces(
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiOkResponse({
    description: 'Archivo generado correctamente',
    schema: {
      type: 'string',
      format: 'binary',
    },
  })
  @ApiBadRequestResponse({
    description: 'La fecha o el formato no son válidos',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  exportarAnual(
    @Req() solicitud: SolicitudAutenticada,
    @Query()
    exportarReporteDto: ExportarReporteDto,
  ): Promise<StreamableFile> {
    return this.exportar(solicitud.usuario.sub, 'ANUAL', exportarReporteDto);
  }

  // Reutiliza el mismo procedimiento para
  // las seis combinaciones de exportación.
  private async exportar(
    usuarioId: number,
    tipoReporte: TipoReporte,
    exportarReporteDto: ExportarReporteDto,
  ): Promise<StreamableFile> {
    const reporte = await this.reportesService.obtenerReporte(
      usuarioId,
      tipoReporte,
      exportarReporteDto.fechaReferencia,
    );

    const archivo = await this.reportesExportacionService.generarArchivo(
      reporte,
      exportarReporteDto.formato,
    );

    const nombreArchivo = [
      'reporte',
      tipoReporte.toLowerCase(),
      reporte.periodo.fechaDesde,
      'al',
      reporte.periodo.fechaHasta,
    ].join('-');

    return new StreamableFile(archivo.contenido, {
      type: archivo.tipoMime,

      disposition: `attachment; filename="${nombreArchivo}.${archivo.extension}"`,

      length: archivo.contenido.length,
    });
  }
}
