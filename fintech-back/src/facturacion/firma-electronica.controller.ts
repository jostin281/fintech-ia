import {
  Body,
  Controller,
  Delete,
  Get,
  Put,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type { SolicitudAutenticada } from '../auth/interfaces/usuario-autenticado.interface';
import { BloqueadoEnDemo } from '../auth/decorators/bloqueado-en-demo.decorator';
import { CargarFirmaElectronicaDto } from './dto/cargar-firma-electronica.dto';
import {
  FirmaElectronicaService,
  type ArchivoFirmaElectronica,
} from './firma-electronica.service';

@ApiTags('Facturación - Firma electrónica')
@ApiBearerAuth('access-token')
@BloqueadoEnDemo()
@Controller('facturacion/firma-electronica')
export class FirmaElectronicaController {
  constructor(
    private readonly firmaElectronicaService: FirmaElectronicaService,
  ) {}

  @Put()
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  @ApiOperation({ summary: 'Cargar o reemplazar la firma electrónica P12' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['archivo', 'clave'],
      properties: {
        archivo: { type: 'string', format: 'binary' },
        clave: { type: 'string', format: 'password' },
      },
    },
  })
  @ApiOkResponse({ description: 'Firma guardada y cifrada correctamente' })
  @ApiBadRequestResponse({
    description: 'El P12, su clave o el certificado no son válidos',
  })
  @ApiUnauthorizedResponse({ description: 'El token falta o no es válido' })
  guardar(
    @Req() solicitud: SolicitudAutenticada,
    @UploadedFile() archivo: ArchivoFirmaElectronica | undefined,
    @Body() cargarFirmaElectronicaDto: CargarFirmaElectronicaDto,
  ) {
    return this.firmaElectronicaService.guardar(
      solicitud.usuario.sub,
      archivo,
      cargarFirmaElectronicaDto.clave,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Consultar vigencia y metadatos de la firma propia',
  })
  @ApiOkResponse({ description: 'Estado de la firma electrónica' })
  @ApiNotFoundResponse({ description: 'No existe una firma activa' })
  obtenerEstado(@Req() solicitud: SolicitudAutenticada) {
    return this.firmaElectronicaService.obtenerEstado(solicitud.usuario.sub);
  }

  @Delete()
  @ApiOperation({ summary: 'Desactivar la firma electrónica almacenada' })
  @ApiOkResponse({ description: 'Firma desactivada correctamente' })
  @ApiNotFoundResponse({ description: 'No existe una firma activa' })
  desactivar(@Req() solicitud: SolicitudAutenticada) {
    return this.firmaElectronicaService.desactivar(solicitud.usuario.sub);
  }
}
