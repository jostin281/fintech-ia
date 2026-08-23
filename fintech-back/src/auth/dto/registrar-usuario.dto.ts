/* eslint-disable prettier/prettier */
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegistrarUsuarioDto {
  @ApiProperty({
    description: 'Nombre completo del usuario',
    example: 'Jorge Yugsi',
    minLength: 2,
    maxLength: 100,
  })
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({
    message: 'El nombre debe ser texto',
  })
  @Length(2, 100, {
    message: 'El nombre debe tener entre 2 y 100 caracteres',
  })
  @Matches(/^[\p{L}\s'-]+$/u, {
    message:
      'El nombre solamente puede contener letras, espacios, guiones y apóstrofes',
  })
  nombre!: string;

  @ApiProperty({
    description: 'Correo electrónico utilizado para iniciar sesión',
    example: 'jorge@correo.com',
    maxLength: 150,
  })
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
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
    description:
      'Contraseña con mayúscula, minúscula, número y carácter especial',
    example: 'Fintech2026*',
    minLength: 8,
    maxLength: 72,
  })
  @IsString({
    message: 'La contraseña debe ser texto',
  })
  @MinLength(8, {
    message: 'La contraseña debe tener al menos 8 caracteres',
  })
  @MaxLength(72, {
    message: 'La contraseña no puede superar los 72 caracteres',
  })
  @Matches(/^\S+$/, {
    message: 'La contraseña no debe contener espacios',
  })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message:
      'La contraseña debe incluir mayúscula, minúscula, número y carácter especial',
  })
  contrasena!: string;
}
