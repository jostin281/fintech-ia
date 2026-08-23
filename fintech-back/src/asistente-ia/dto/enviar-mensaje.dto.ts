import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class EnviarMensajeDto {
  @ApiProperty({
    description: 'Pregunta o consulta enviada al asistente financiero',
    example: '¿En qué categoría gasté más durante este mes?',
    maxLength: 2000,
  })
  // Elimina espacios innecesarios antes de validar y guardar el mensaje.
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString({
    message: 'El contenido debe ser un texto',
  })
  @IsNotEmpty({
    message: 'El contenido del mensaje es obligatorio',
  })
  @MaxLength(2000, {
    message: 'El mensaje no puede superar los 2000 caracteres',
  })
  contenido!: string;
}
