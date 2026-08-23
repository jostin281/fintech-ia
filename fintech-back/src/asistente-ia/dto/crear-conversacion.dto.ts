import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CrearConversacionDto {
  @ApiProperty({
    description: 'Título que identificará la conversación',
    example: 'Análisis de mis gastos de agosto',
    maxLength: 120,
  })
  // Elimina espacios innecesarios antes de validar.
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString({
    message: 'El título debe ser un texto',
  })
  @IsNotEmpty({
    message: 'El título es obligatorio',
  })
  @MaxLength(120, {
    message: 'El título no puede superar los 120 caracteres',
  })
  titulo!: string;
}
