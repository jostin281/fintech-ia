import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CambiarContrasenaDto {
  @ApiProperty({ description: 'Contraseña actual del usuario' })
  @IsString({ message: 'La contraseña actual debe ser texto' })
  @IsNotEmpty({ message: 'La contraseña actual es obligatoria' })
  contrasenaActual!: string;

  @ApiProperty({ description: 'Nueva contraseña (mínimo 11 caracteres, para que sea una contraseña fuerte)' })
  @IsString({ message: 'La nueva contraseña debe ser texto' })
  @MinLength(11, { message: 'La nueva contraseña debe contener al menos 11 caracteres para ser una contraseña fuerte' })
  nuevaContrasena!: string;
}
