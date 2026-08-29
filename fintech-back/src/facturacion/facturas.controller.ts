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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type { SolicitudAutenticada } from '../auth/interfaces/usuario-autenticado.interface';
import { BloqueadoEnDemo } from '../auth/decorators/bloqueado-en-demo.decorator';
import { ActualizarFacturaDto } from './dto/actualizar-factura.dto';
import { CrearFacturaDto } from './dto/crear-factura.dto';
import { EnviarFacturaCorreoDto } from './dto/enviar-factura-correo.dto';
import { FiltrarFacturasDto } from './dto/filtrar-facturas.dto';
import { FacturasService } from './facturas.service';

// Nota sobre el modo demo: este controlador NO está bloqueado por completo
// (a diferencia de firma-electronica, sri-credenciales, comprobantes-recibidos
// y rdep). Una cuenta demo puede crear, ver y "emitir" facturas para conocer
// la función — pero @Post(':id/emitir') simula la autorización en vez de
// firmar con un certificado real y enviarla al SRI real, y consultar-sri /
// reenviar-sri (que sí tocan al SRI real) quedan bloqueados abajo.
@ApiTags('Facturación - Facturas electrónicas')
@ApiBearerAuth('access-token')
@Controller('facturacion/facturas')
export class FacturasController {
  constructor(private readonly facturasService: FacturasService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un borrador de factura' })
  @ApiCreatedResponse({ description: 'Borrador creado correctamente' })
  @ApiBadRequestResponse({
    description: 'Los detalles o importes no son válidos',
  })
  @ApiNotFoundResponse({ description: 'El cliente o un producto no existe' })
  @ApiUnauthorizedResponse({ description: 'El token falta o no es válido' })
  crear(
    @Req() solicitud: SolicitudAutenticada,
    @Body() crearFacturaDto: CrearFacturaDto,
  ) {
    return this.facturasService.crear(solicitud.usuario.sub, crearFacturaDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar las facturas propias' })
  @ApiOkResponse({ description: 'Facturas obtenidas correctamente' })
  @ApiBadRequestResponse({ description: 'Los filtros no son válidos' })
  listar(
    @Req() solicitud: SolicitudAutenticada,
    @Query() filtros: FiltrarFacturasDto,
  ) {
    return this.facturasService.listar(solicitud.usuario.sub, filtros);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar una factura propia' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Factura obtenida correctamente' })
  @ApiNotFoundResponse({
    description: 'La factura no existe o no pertenece al usuario',
  })
  obtenerUno(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) facturaId: number,
  ) {
    return this.facturasService.obtenerUno(solicitud.usuario.sub, facturaId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar una factura mientras sea borrador' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Borrador actualizado correctamente' })
  @ApiBadRequestResponse({ description: 'Los datos enviados no son válidos' })
  @ApiConflictResponse({ description: 'La factura ya inició su emisión' })
  @ApiNotFoundResponse({
    description: 'La factura, cliente o producto no existe',
  })
  actualizar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) facturaId: number,
    @Body() actualizarFacturaDto: ActualizarFacturaDto,
  ) {
    return this.facturasService.actualizar(
      solicitud.usuario.sub,
      facturaId,
      actualizarFacturaDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Anular localmente una factura en borrador' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Borrador anulado correctamente' })
  @ApiNotFoundResponse({ description: 'La factura no es un borrador activo' })
  anularBorrador(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) facturaId: number,
  ) {
    return this.facturasService.anularBorrador(
      solicitud.usuario.sub,
      facturaId,
    );
  }

  @Post(':id/emitir')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Asignar secuencial, firmar y enviar la factura al SRI',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({
    description: 'Resultado de recepción y autorización del SRI',
  })
  @ApiBadRequestResponse({
    description: 'La firma o el comprobante no son válidos',
  })
  @ApiConflictResponse({
    description: 'La factura ya fue emitida o producción está bloqueada',
  })
  @ApiServiceUnavailableResponse({
    description: 'No se pudo completar la comunicación con el SRI',
  })
  emitir(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) facturaId: number,
  ) {
    // Cuenta demo: emisión simulada, sin firma real ni conexión al SRI real.
    if (solicitud.usuario.esDemo) {
      return this.facturasService.emitirSimulado(
        solicitud.usuario.sub,
        facturaId,
      );
    }
    return this.facturasService.emitir(solicitud.usuario.sub, facturaId);
  }

  @Post(':id/consultar-sri')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Consultar la autorización de una clave ya enviada',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Estado actualizado desde el SRI' })
  @ApiServiceUnavailableResponse({ description: 'El SRI no está disponible' })
  @BloqueadoEnDemo()
  consultarSri(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) facturaId: number,
  ) {
    return this.facturasService.consultarSri(solicitud.usuario.sub, facturaId);
  }

  @Post(':id/reenviar-sri')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reenviar exactamente el XML firmado tras un fallo de recepción',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Resultado del reenvío al SRI' })
  @ApiConflictResponse({
    description: 'La factura no se encuentra en estado FIRMADA',
  })
  @ApiServiceUnavailableResponse({ description: 'El SRI no está disponible' })
  @BloqueadoEnDemo()
  reenviarSri(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) facturaId: number,
  ) {
    return this.facturasService.reenviarSri(solicitud.usuario.sub, facturaId);
  }

  @Post(':id/enviar-correo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Enviar el RIDE de una factura emitida por correo al cliente',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Correo enviado correctamente' })
  @ApiBadRequestResponse({ description: 'Falta un correo de destino' })
  @ApiConflictResponse({ description: 'La factura todavía es un borrador' })
  @ApiServiceUnavailableResponse({
    description: 'El envío de correo no está configurado o falló',
  })
  @BloqueadoEnDemo()
  enviarPorCorreo(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) facturaId: number,
    @Body() enviarFacturaCorreoDto: EnviarFacturaCorreoDto,
  ) {
    return this.facturasService.enviarPorCorreo(
      solicitud.usuario.sub,
      facturaId,
      enviarFacturaCorreoDto.correo,
    );
  }

  @Get(':id/xml')
  @ApiOperation({ summary: 'Descargar el XML firmado o autorizado' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiProduces('application/xml')
  async descargarXml(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) facturaId: number,
  ) {
    const archivo = await this.facturasService.obtenerXml(
      solicitud.usuario.sub,
      facturaId,
    );

    return new StreamableFile(archivo, {
      type: 'application/xml; charset=utf-8',
      disposition: `attachment; filename="factura-${facturaId}.xml"`,
    });
  }

  @Get(':id/ride')
  @ApiOperation({ summary: 'Generar la representación impresa RIDE en PDF' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiProduces('application/pdf')
  async descargarRide(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) facturaId: number,
  ) {
    const archivo = await this.facturasService.generarRide(
      solicitud.usuario.sub,
      facturaId,
    );

    return new StreamableFile(archivo, {
      type: 'application/pdf',
      disposition: `inline; filename="factura-${facturaId}-ride.pdf"`,
    });
  }
}
