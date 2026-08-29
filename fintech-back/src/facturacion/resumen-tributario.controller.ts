import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';

import type { SolicitudAutenticada } from '../auth/interfaces/usuario-autenticado.interface';
import { BloqueadoEnDemo } from '../auth/decorators/bloqueado-en-demo.decorator';
import { BorradoresSriExportacionService } from './borradores-sri-exportacion.service';
import { CalcularImpuestoRentaDto } from './dto/calcular-impuesto-renta.dto';
import { ConfigurarCategoriaTributariaDto } from './dto/configurar-categoria-tributaria.dto';
import { GenerarBorradorSriDto } from './dto/generar-borrador-sri.dto';
import { ResumenTributarioService } from './resumen-tributario.service';

@ApiTags('Facturación - Resumen tributario y Fintech')
@ApiBearerAuth('access-token')
@BloqueadoEnDemo()
@Controller('facturacion')
export class ResumenTributarioController {
  constructor(
    private readonly resumenTributarioService: ResumenTributarioService,
    private readonly borradoresSriExportacionService: BorradoresSriExportacionService,
  ) {}

  @Put('configuracion-categorias')
  @ApiOperation({
    summary:
      'Relacionar una categoría financiera con su tratamiento tributario',
  })
  @ApiOkResponse({ description: 'Configuración guardada correctamente' })
  @ApiBadRequestResponse({
    description: 'El tratamiento no coincide con la categoría',
  })
  @ApiNotFoundResponse({ description: 'La categoría financiera no existe' })
  configurarCategoria(
    @Req() solicitud: SolicitudAutenticada,
    @Body() dto: ConfigurarCategoriaTributariaDto,
  ) {
    return this.resumenTributarioService.configurarCategoria(
      solicitud.usuario.sub,
      dto,
    );
  }

  @Get('configuracion-categorias')
  @ApiOperation({ summary: 'Listar la clasificación tributaria de categorías' })
  @ApiOkResponse({ description: 'Configuraciones obtenidas correctamente' })
  listarConfiguraciones(@Req() solicitud: SolicitudAutenticada) {
    return this.resumenTributarioService.listarConfiguraciones(
      solicitud.usuario.sub,
    );
  }

  @Get('resumen-tributario/:anio')
  @ApiOperation({
    summary: 'Consultar ingresos, gastos, IVA y gastos personales del año',
  })
  @ApiParam({ name: 'anio', type: Number, example: 2026 })
  @ApiOkResponse({ description: 'Resumen tributario obtenido correctamente' })
  @ApiBadRequestResponse({ description: 'El año no es válido' })
  obtenerResumen(
    @Req() solicitud: SolicitudAutenticada,
    @Param('anio', ParseIntPipe) anio: number,
  ) {
    return this.resumenTributarioService.obtenerResumen(
      solicitud.usuario.sub,
      anio,
    );
  }

  @Post('impuesto-renta/:anio/calcular')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Calcular una estimación del Impuesto a la Renta' })
  @ApiParam({ name: 'anio', type: Number, example: 2026 })
  @ApiOkResponse({ description: 'Estimación calculada correctamente' })
  @ApiBadRequestResponse({
    description: 'Falta una tabla o los datos no son válidos',
  })
  calcularImpuestoRenta(
    @Req() solicitud: SolicitudAutenticada,
    @Param('anio', ParseIntPipe) anio: number,
    @Body() dto: CalcularImpuestoRentaDto,
  ) {
    return this.resumenTributarioService.calcularImpuestoRenta(
      solicitud.usuario.sub,
      anio,
      dto,
    );
  }

  @Get('formulario-104/:anio/:mes/prellenado')
  @ApiOperation({
    summary:
      'Prellenar los casilleros del Formulario 104 (IVA) de un mes con datos ya registrados en Fintech',
  })
  @ApiParam({ name: 'anio', type: Number, example: 2026 })
  @ApiParam({ name: 'mes', type: Number, example: 8, description: '1 a 12' })
  @ApiOkResponse({ description: 'Prellenado calculado correctamente' })
  @ApiBadRequestResponse({ description: 'El año o el mes no son válidos' })
  prellenarFormulario104(
    @Req() solicitud: SolicitudAutenticada,
    @Param('anio', ParseIntPipe) anio: number,
    @Param('mes', ParseIntPipe) mes: number,
  ) {
    return this.resumenTributarioService.obtenerPrellenadoFormulario104(
      solicitud.usuario.sub,
      anio,
      mes,
    );
  }

  @Post('borradores-sri/exportar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Generar el PDF real de un borrador de formulario SRI (104 o 107) para descargar',
  })
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    description: 'PDF generado correctamente',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiBadRequestResponse({ description: 'Los datos del borrador no son válidos' })
  async exportarBorradorSri(
    @Body() dto: GenerarBorradorSriDto,
  ): Promise<StreamableFile> {
    const contenido = await this.borradoresSriExportacionService.generarPdf(dto);

    const nombreArchivo = [
      'borrador-sri',
      dto.tipoFormulario.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase(),
      dto.numeroAdhesion,
    ].join('-');

    return new StreamableFile(contenido, {
      type: 'application/pdf',
      disposition: `attachment; filename="${nombreArchivo}.pdf"`,
      length: contenido.length,
    });
  }
}
