import {
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
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type { SolicitudAutenticada } from '../auth/interfaces/usuario-autenticado.interface';
import { ListarNotificacionesDto } from './dto/listar-notificaciones.dto';
import { NotificacionesService } from './notificaciones.service';

@ApiTags('Notificaciones')
@ApiBearerAuth('access-token')
@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Post('sincronizar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generar las alertas actuales del usuario autenticado',
  })
  @ApiOkResponse({
    description: 'Alertas sincronizadas correctamente',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  sincronizar(@Req() solicitud: SolicitudAutenticada) {
    return this.notificacionesService.sincronizarAlertas(solicitud.usuario.sub);
  }

  @Get()
  @ApiOperation({
    summary: 'Consultar las notificaciones internas del usuario',
  })
  @ApiQuery({
    name: 'soloNoLeidas',
    required: false,
    type: Boolean,
    example: true,
  })
  @ApiOkResponse({
    description: 'Notificaciones obtenidas correctamente',
  })
  @ApiBadRequestResponse({
    description: 'El filtro enviado no es válido',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  listar(
    @Req() solicitud: SolicitudAutenticada,
    @Query()
    filtros: ListarNotificacionesDto,
  ) {
    return this.notificacionesService.listarDelUsuario(
      solicitud.usuario.sub,
      filtros,
    );
  }

  @Patch('leer-todas')
  @ApiOperation({
    summary: 'Marcar todas las notificaciones como leídas',
  })
  @ApiOkResponse({
    description: 'Notificaciones marcadas como leídas',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  marcarTodasComoLeidas(@Req() solicitud: SolicitudAutenticada) {
    return this.notificacionesService.marcarTodasComoLeidas(
      solicitud.usuario.sub,
    );
  }

  @Patch(':id/leer')
  @ApiOperation({
    summary: 'Marcar una notificación propia como leída',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la notificación',
    example: 1,
    type: Number,
  })
  @ApiOkResponse({
    description: 'Notificación marcada como leída',
  })
  @ApiBadRequestResponse({
    description: 'El identificador no es válido',
  })
  @ApiNotFoundResponse({
    description: 'La notificación no existe o pertenece a otro usuario',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  marcarComoLeida(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe)
    notificacionId: number,
  ) {
    return this.notificacionesService.marcarComoLeida(
      solicitud.usuario.sub,
      notificacionId,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar lógicamente una notificación propia',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la notificación',
    example: 1,
    type: Number,
  })
  @ApiOkResponse({
    description: 'Notificación eliminada correctamente',
  })
  @ApiBadRequestResponse({
    description: 'El identificador no es válido',
  })
  @ApiNotFoundResponse({
    description:
      'La notificación no existe, ya fue eliminada o pertenece a otro usuario',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  eliminar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe)
    notificacionId: number,
  ) {
    return this.notificacionesService.eliminar(
      solicitud.usuario.sub,
      notificacionId,
    );
  }
}
