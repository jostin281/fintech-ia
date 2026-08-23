import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class IniciarSesionDto {
  @ApiProperty({
    description: 'Correo electrónico del usuario',
    example: 'jorge@correo.com',
  })
  @Transform(({ value }: TransformFnParams): string =>
    typeof value === 'string' ? value.trim().toLowerCase() : '',
  )
  @IsEmail(
    {},
    {
      message: 'Debes ingresar un correo electrónico válido',
    },
  )
  @MaxLength(150, {
    message: 'El correo no puede superar los 150 caracteres',
  })
  correo!: string;

  @ApiProperty({
    description: 'Contraseña del usuario',
    example: 'Fintech2026*',
  })
  @IsString({
    message: 'La contraseña debe ser texto',
  })
  @IsNotEmpty({
    message: 'La contraseña es obligatoria',
  })
  @MaxLength(72, {
    message: 'La contraseña no puede superar los 72 caracteres',
  })
  contrasena!: string;
}
