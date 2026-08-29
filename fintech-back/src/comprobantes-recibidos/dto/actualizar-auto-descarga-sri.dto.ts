import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

// Prender/apagar la descarga automática sin tener que reenviar la clave.
export class ActualizarAutoDescargaSriDto {
  @ApiProperty({ description: 'Activa o desactiva la descarga automática diaria' })
  @IsBoolean()
  autoDescargaHabilitada: boolean;
}
