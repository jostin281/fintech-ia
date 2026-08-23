import { Controller, Get, Param, ParseIntPipe, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import type { SolicitudAutenticada } from '../auth/interfaces/usuario-autenticado.interface';
import { ProveedoresService } from './proveedores.service';

@ApiTags('Comprobantes recibidos - Proveedores')
@ApiBearerAuth('access-token')
@Controller('comprobantes-recibidos/proveedores')
export class ProveedoresController {
  constructor(private readonly proveedoresService: ProveedoresService) {}

  @Get()
  @ApiOperation({
    summary:
      'Listar los proveedores (emisores) creados a partir de comprobantes recibidos, con sus totales',
  })
  @ApiOkResponse({ description: 'Lista obtenida correctamente' })
  listar(@Req() solicitud: SolicitudAutenticada) {
    return this.proveedoresService.listarDelUsuario(solicitud.usuario.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar un proveedor propio con sus totales' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Proveedor obtenido correctamente' })
  @ApiNotFoundResponse({
    description: 'El proveedor no existe o no pertenece al usuario',
  })
  obtenerUno(
    @Req() solicitud: SolicitudAutenticada,
    @Param('id', ParseIntPipe) proveedorId: number,
  ) {
    return this.proveedoresService.obtenerUno(
      solicitud.usuario.sub,
      proveedorId,
    );
  }
}
