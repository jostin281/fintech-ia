import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CargarFirmaElectronicaDto {
  @ApiProperty({
    description:
      'Contraseña actual del archivo P12. Se utiliza en memoria y no se almacena',
    example: 'MiClaveSegura',
    format: 'password',
  })
  @IsString({ message: 'La contraseña del certificado debe ser texto' })
  @IsNotEmpty({ message: 'La contraseña del certificado es obligatoria' })
  @MaxLength(200, {
    message: 'La contraseña del certificado admite máximo 200 caracteres',
  })
  clave!: string;
}
