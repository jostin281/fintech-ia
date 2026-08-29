import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

// Datos que el usuario ingresa para activar la descarga automática de sus
// comprobantes recibidos desde SRI en Línea.
export class GuardarCredencialesSriDto {
  @ApiProperty({
    description: 'Usuario de SRI en Línea (RUC, cédula o el que uses para entrar)',
    example: '1712345678001',
  })
  @IsString()
  @Length(3, 50)
  usuarioSri: string;

  @ApiProperty({
    description: 'Clave de SRI en Línea. Se cifra antes de guardarse; nunca se devuelve.',
    example: 'tu-clave-del-sri',
  })
  @IsString()
  @Length(1, 200)
  claveSri: string;

  @ApiProperty({
    description:
      'Campo opcional "C.I. adicional" del login del SRI (para entrar como tercero autorizado, por ejemplo un contador). Déjalo vacío si entras con tu propia cuenta.',
    required: false,
    example: '1700000001',
  })
  @IsOptional()
  @IsString()
  @Length(0, 50)
  ciAdicionalSri?: string;

  @ApiProperty({
    description:
      'Si además de guardar las credenciales quieres activar la descarga automática diaria. Por defecto queda apagada.',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  autoDescargaHabilitada?: boolean;
}
