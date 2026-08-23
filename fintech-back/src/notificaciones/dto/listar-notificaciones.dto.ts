import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class ListarNotificacionesDto {
  @ApiPropertyOptional({
    description:
      'Indica si deben mostrarse solamente las notificaciones no leídas',
    example: true,
    type: Boolean,
  })
  @Transform(({ value }: TransformFnParams): unknown => {
    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }

    return value;
  })
  @IsOptional()
  @IsBoolean({
    message: 'El filtro soloNoLeidas debe ser true o false',
  })
  soloNoLeidas?: boolean;
}
