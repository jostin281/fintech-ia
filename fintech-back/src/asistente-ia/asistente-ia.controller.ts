import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type { SolicitudAutenticada } from '../auth/interfaces/usuario-autenticado.interface';
import { AsistenteIaService } from './asistente-ia.service';
import { CrearConversacionDto } from './dto/crear-conversacion.dto';
import { EnviarMensajeDto } from './dto/enviar-mensaje.dto';

@ApiTags('Asistente IA')
@ApiBearerAuth('access-token')
@Controller('asistente-ia')
export class AsistenteIaController {
  constructor(private readonly asistenteIaService: AsistenteIaService) {}

  @Post('conversaciones')
  @ApiOperation({
    summary: 'Crear una conversación para el usuario autenticado',
  })
  @ApiCreatedResponse({
    description: 'Conversación creada correctamente',
  })
  @ApiBadRequestResponse({
    description: 'El título enviado no es válido',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  crearConversacion(
    @Req() solicitud: SolicitudAutenticada,
    @Body() crearConversacionDto: CrearConversacionDto,
  ) {
    return this.asistenteIaService.crearConversacion(
      solicitud.usuario.sub,
      crearConversacionDto,
    );
  }

  @Post('conversaciones/:id/mensajes')
  @ApiOperation({
    summary: 'Enviar una pregunta y obtener una respuesta del asistente',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la conversación',
    example: 1,
  })
  @ApiCreatedResponse({
    description: 'Pregunta procesada y respuesta generada correctamente',
  })
  @ApiBadRequestResponse({
    description: 'El identificador o el contenido del mensaje no es válido',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  @ApiNotFoundResponse({
    description: 'La conversación no existe o no pertenece al usuario',
  })
  enviarMensaje(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) conversacionId: number,
    @Body() enviarMensajeDto: EnviarMensajeDto,
  ) {
    return this.asistenteIaService.enviarMensaje(
      solicitud.usuario.sub,
      conversacionId,
      enviarMensajeDto,
    );
  }

  @Get('contexto-financiero/mensual')
  @ApiOperation({
    summary: 'Obtener el contexto financiero del mes actual',
  })
  @ApiOkResponse({
    description: 'Contexto financiero obtenido correctamente',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  obtenerContextoFinancieroMensual(@Req() solicitud: SolicitudAutenticada) {
    return this.asistenteIaService.obtenerContextoFinancieroMensual(
      solicitud.usuario.sub,
    );
  }

  @Get('conversaciones')
  @ApiOperation({
    summary: 'Listar las conversaciones del usuario autenticado',
  })
  @ApiOkResponse({
    description: 'Conversaciones obtenidas correctamente',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  listarConversaciones(@Req() solicitud: SolicitudAutenticada) {
    return this.asistenteIaService.listarConversaciones(solicitud.usuario.sub);
  }

  @Get('conversaciones/:id')
  @ApiOperation({
    summary: 'Consultar una conversación propia con sus mensajes',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la conversación',
    example: 1,
  })
  @ApiOkResponse({
    description: 'Conversación obtenida correctamente',
  })
  @ApiBadRequestResponse({
    description: 'El identificador no es un número válido',
  })
  @ApiUnauthorizedResponse({
    description: 'El token falta, es inválido o ha expirado',
  })
  @ApiNotFoundResponse({
    description: 'La conversación no existe o no pertenece al usuario',
  })
  obtenerConversacion(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) conversacionId: number,
  ) {
    return this.asistenteIaService.obtenerConversacion(
      solicitud.usuario.sub,
      conversacionId,
    );
  }
}
