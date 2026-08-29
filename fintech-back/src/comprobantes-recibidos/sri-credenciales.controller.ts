import { Body, Controller, Delete, Get, Patch, Post, Put, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type { SolicitudAutenticada } from '../auth/interfaces/usuario-autenticado.interface';
import { BloqueadoEnDemo } from '../auth/decorators/bloqueado-en-demo.decorator';
import { ActualizarAutoDescargaSriDto } from './dto/actualizar-auto-descarga-sri.dto';
import { GuardarCredencialesSriDto } from './dto/guardar-credenciales-sri.dto';
import { SriCredencialesService } from './sri-credenciales.service';
import { SriDescargaRunnerService } from './sri-descarga-runner.service';

// Función OPCIONAL y apagada por defecto: el usuario guarda su usuario/clave
// de SRI en Línea (se cifran con AES-256-GCM) para que sus comprobantes
// recibidos se descarguen automáticamente. No es una API oficial del SRI,
// es automatización de navegador — el propio usuario decide activarla.
@ApiTags('Comprobantes recibidos — Credenciales SRI (automática, opcional)')
@ApiBearerAuth('access-token')
@BloqueadoEnDemo()
@Controller('sri-credenciales')
export class SriCredencialesController {
  constructor(
    private readonly sriCredencialesService: SriCredencialesService,
    private readonly sriDescargaRunnerService: SriDescargaRunnerService,
  ) {}

  @Put()
  @ApiOperation({
    summary: 'Guardar (o actualizar) las credenciales de SRI en Línea del usuario, cifradas',
  })
  @ApiOkResponse({ description: 'Credenciales guardadas correctamente' })
  @ApiUnauthorizedResponse({ description: 'El token falta, es inválido o ha expirado' })
  guardar(
    @Req() solicitud: SolicitudAutenticada,
    @Body() dto: GuardarCredencialesSriDto,
  ) {
    return this.sriCredencialesService.guardar(solicitud.usuario.sub, dto);
  }

  @Get()
  @ApiOperation({
    summary:
      'Ver el estado de las credenciales SRI del usuario (nunca devuelve la clave)',
  })
  @ApiOkResponse({ description: 'Estado obtenido correctamente' })
  obtenerEstado(@Req() solicitud: SolicitudAutenticada) {
    return this.sriCredencialesService.obtenerEstado(solicitud.usuario.sub);
  }

  @Patch('auto-descarga')
  @ApiOperation({
    summary: 'Activar o desactivar la descarga automática diaria, sin reenviar la clave',
  })
  @ApiOkResponse({ description: 'Preferencia actualizada' })
  actualizarAutoDescarga(
    @Req() solicitud: SolicitudAutenticada,
    @Body() dto: ActualizarAutoDescargaSriDto,
  ) {
    return this.sriCredencialesService.actualizarAutoDescarga(
      solicitud.usuario.sub,
      dto,
    );
  }

  @Delete()
  @ApiOperation({ summary: 'Eliminar las credenciales SRI guardadas del usuario' })
  @ApiOkResponse({ description: 'Credenciales eliminadas' })
  eliminar(@Req() solicitud: SolicitudAutenticada) {
    return this.sriCredencialesService.eliminar(solicitud.usuario.sub);
  }

  @Post('descargar-ahora')
  @ApiOperation({
    summary:
      'Probar la descarga ahora mismo (sin esperar al job diario). Puede tardar hasta unos minutos.',
  })
  @ApiOkResponse({ description: 'Resultado de la descarga' })
  descargarAhora(@Req() solicitud: SolicitudAutenticada) {
    return this.sriDescargaRunnerService.ejecutarParaUsuario(
      solicitud.usuario.sub,
    );
  }
}
