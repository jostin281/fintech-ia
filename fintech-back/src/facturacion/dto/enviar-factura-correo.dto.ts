import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, MaxLength } from 'class-validator';

function limpiarTextoOpcional(valor: unknown): unknown {
  if (typeof valor !== 'string') {
    return valor;
  }

  const texto = valor.trim();
  return texto.length === 0 ? undefined : texto;
}

export class EnviarFacturaCorreoDto {
  @ApiPropertyOptional({
    description:
      'Correo de destino; si se omite, se usa el correo ya guardado del cliente',
    example: 'cliente@example.com',
  })
  @Transform(({ value }) => limpiarTextoOpcional(value))
  @IsOptional()
  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  @MaxLength(150, { message: 'El correo admite máximo 150 caracteres' })
  correo?: string;
}
