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
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import type { SolicitudAutenticada } from '../auth/interfaces/usuario-autenticado.interface';
import { AnexoRdepExcelService } from './anexo-rdep-excel.service';
import {
  ActualizarFormularioRdepDto,
  CrearFormularioRdepDto,
} from './dto/crear-formulario-rdep.dto';
import { RdepPdfService } from './rdep-pdf.service';
import { RdepService } from './rdep.service';
import { CATALOGO_PAISES_RDEP } from './utilidades/catalogo-paises-rdep';
import {
  CATALOGO_CARGAS_FAMILIARES,
  CATALOGO_CONDICION_DISCAPACIDAD,
  CATALOGO_CONVENIO_DOBLE_IMPOSICION,
  CATALOGO_ENTE_SEGURIDAD_SOCIAL,
  CATALOGO_RESIDENCIA_TRABAJADOR,
  CATALOGO_SISTEMA_SALARIO_NETO,
  CATALOGO_TIPO_EMPLEADOR,
  CATALOGO_TIPO_IDENTIFICACION_TRABAJADOR,
} from './utilidades/catalogos-rdep';
import { mapearFormularioRdepCompleto } from './utilidades/rdep-mapeo';

@ApiTags('RDEP / Formulario 107')
@ApiBearerAuth('access-token')
@Controller('rdep')
export class RdepController {
  constructor(
    private readonly rdepService: RdepService,
    private readonly rdepPdfService: RdepPdfService,
    private readonly anexoRdepExcelService: AnexoRdepExcelService,
  ) {}

  @Get('catalogos')
  @ApiOperation({
    summary:
      'Catálogos oficiales del Anexo RDEP (tipos, países, etc.) para armar los selectores del formulario',
  })
  @ApiOkResponse({ description: 'Catálogos obtenidos correctamente' })
  obtenerCatalogos() {
    return {
      tiposIdentificacionTrabajador: CATALOGO_TIPO_IDENTIFICACION_TRABAJADOR,
      residenciaTrabajador: CATALOGO_RESIDENCIA_TRABAJADOR,
      condicionDiscapacidad: CATALOGO_CONDICION_DISCAPACIDAD,
      convenioDobleImposicion: CATALOGO_CONVENIO_DOBLE_IMPOSICION,
      sistemaSalarioNeto: CATALOGO_SISTEMA_SALARIO_NETO,
      tipoEmpleador: CATALOGO_TIPO_EMPLEADOR,
      enteSeguridadSocial: CATALOGO_ENTE_SEGURIDAD_SOCIAL,
      cargasFamiliares: CATALOGO_CARGAS_FAMILIARES,
      paises: CATALOGO_PAISES_RDEP,
    };
  }

  @Post()
  @ApiOperation({
    summary: 'Crear un Formulario 107 / RDEP en estado BORRADOR para un período fiscal',
  })
  @ApiCreatedResponse({ description: 'Formulario creado correctamente' })
  @ApiBadRequestResponse({ description: 'Los datos no son válidos' })
  @ApiConflictResponse({ description: 'Ya existe un formulario para ese período' })
  @ApiNotFoundResponse({ description: 'El usuario no tiene perfil tributario activo' })
  crear(
    @Req() solicitud: SolicitudAutenticada,
    @Body() dto: CrearFormularioRdepDto,
  ) {
    return this.rdepService.crear(solicitud.usuario.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar los Formularios 107 / RDEP del usuario (por período)' })
  @ApiQuery({ name: 'periodoFiscal', required: false, type: Number })
  @ApiOkResponse({ description: 'Listado obtenido correctamente' })
  listar(
    @Req() solicitud: SolicitudAutenticada,
    @Query('periodoFiscal') periodoFiscal?: string,
  ) {
    return this.rdepService.listar(
      solicitud.usuario.sub,
      periodoFiscal ? Number(periodoFiscal) : undefined,
    );
  }

  @Get('plantilla')
  @ApiOperation({
    summary:
      'Obtener una plantilla para un Formulario 107 / RDEP nuevo, con los datos del período fiscal más reciente ya registrado (identidad del trabajador, sueldos, gastos personales, etc.)',
  })
  @ApiOkResponse({
    description:
      '{ encontrado: false } si el usuario todavía no tiene ningún formulario, o { encontrado: true, periodoFiscalOrigen, plantilla } con los valores para prellenar el formulario nuevo',
  })
  obtenerPlantilla(@Req() solicitud: SolicitudAutenticada) {
    return this.rdepService.obtenerPlantillaUltimoPeriodo(solicitud.usuario.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener el detalle de un Formulario 107 / RDEP' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ description: 'Formulario obtenido correctamente' })
  @ApiNotFoundResponse({ description: 'El formulario no existe' })
  @ApiForbiddenResponse({ description: 'El formulario no pertenece al usuario' })
  obtener(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.rdepService.obtener(solicitud.usuario.sub, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar un Formulario 107 / RDEP en estado BORRADOR o VALIDADO',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ description: 'Formulario actualizado correctamente' })
  @ApiConflictResponse({ description: 'El formulario ya fue generado (solo lectura)' })
  actualizar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarFormularioRdepDto,
  ) {
    return this.rdepService.actualizar(solicitud.usuario.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un borrador de Formulario 107 / RDEP' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ description: 'Borrador eliminado correctamente' })
  @ApiConflictResponse({ description: 'Solo se puede eliminar un formulario en BORRADOR' })
  eliminar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.rdepService.eliminar(solicitud.usuario.sub, id);
  }

  @Post(':id/validar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Ejecutar todas las validaciones oficiales del RDEP sobre el formulario y devolver los errores encontrados',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({
    description:
      'Resultado de la validación: { valido, totalErrores, errores: [{campo, valorIngresado, motivo, comoCorregirlo}] }',
  })
  validar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.rdepService.validar(solicitud.usuario.sub, id);
  }

  @Post(':id/generar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Marcar como GENERADO un formulario ya validado, habilitando la descarga del PDF final y el anexo Excel oficial',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ description: 'Formulario generado correctamente' })
  @ApiConflictResponse({ description: 'El formulario debe estar VALIDADO sin errores' })
  generar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.rdepService.generar(solicitud.usuario.sub, id);
  }

  @Get(':id/historial')
  @ApiOperation({ summary: 'Historial de auditoría de un Formulario 107 / RDEP' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ description: 'Historial obtenido correctamente' })
  historial(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.rdepService.obtenerHistorial(solicitud.usuario.sub, id);
  }

  @Get(':id/pdf')
  @ApiOperation({
    summary:
      'Vista previa (o documento final, si ya está GENERADO) del Formulario 107 en PDF, con la información actual del formulario',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    description: 'PDF generado correctamente',
    schema: { type: 'string', format: 'binary' },
  })
  async descargarPdf(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StreamableFile> {
    const { formulario, perfil } = await this.rdepService.obtenerParaExportar(
      solicitud.usuario.sub,
      id,
    );

    const contenido = await this.rdepPdfService.generarPdf({
      ...mapearFormularioRdepCompleto(formulario),
      id: formulario.id,
      estado: formulario.estado,
      rucEmpleador: perfil.ruc,
      razonSocialEmpleador: perfil.razonSocial,
    });

    return new StreamableFile(contenido, {
      type: 'application/pdf',
      disposition: `attachment; filename="formulario-107-rdep-${formulario.periodoFiscal}.pdf"`,
      length: contenido.length,
    });
  }

  @Get(':id/anexo-excel')
  @ApiOperation({
    summary:
      'Anexo RDEP oficial en Excel (plantilla "Datos del Empleador" + "Retenciones Trabajadores" del SRI), disponible solo cuando el formulario ya está GENERADO',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiOkResponse({
    description: 'Anexo Excel oficial generado correctamente',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiConflictResponse({ description: 'El formulario todavía no está GENERADO' })
  async descargarAnexoExcel(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StreamableFile> {
    const { formulario, perfil } = await this.rdepService.obtenerParaAnexoExcel(
      solicitud.usuario.sub,
      id,
    );

    const contenido = await this.anexoRdepExcelService.generarAnexoExcel({
      ...mapearFormularioRdepCompleto(formulario),
      rucEmpleador: perfil.ruc,
      razonSocialEmpleador: perfil.razonSocial,
    });

    return new StreamableFile(contenido, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="anexo-rdep-${formulario.periodoFiscal}.xlsx"`,
      length: contenido.length,
    });
  }
}
