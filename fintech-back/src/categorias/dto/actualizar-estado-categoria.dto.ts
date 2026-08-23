import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ActualizarEstadoCategoriaDto {
  @ApiProperty({
    description: 'Indica si la categoría está activa o desactivada',
    example: false,
    type: Boolean,
  })
  @IsBoolean({
    message: 'El campo activa debe ser verdadero o falso',
  })
  activa!: boolean;
}
