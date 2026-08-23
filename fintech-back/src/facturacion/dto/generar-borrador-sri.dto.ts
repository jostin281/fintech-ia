import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

// Una fila del detalle del borrador (ej: "IVA Débito (Ventas 15%)": "+$375.00 USD").
export class LineaBorradorSriDto {
  @ApiProperty({ example: 'IVA Débito (Ventas 15%)' })
  @IsString()
  @MaxLength(120)
  etiqueta!: string;

  @ApiProperty({ example: '+$375.00 USD' })
  @IsString()
  @MaxLength(60)
  valor!: string;
}

// El backend solo renderiza el PDF: los cálculos tributarios (IVA, Renta,
// Retenciones) ya se hicieron en el simulador del frontend o con las tablas
// oficiales del backend (resumen-tributario.service.ts / impuesto-renta).
export class GenerarBorradorSriDto {
  @ApiProperty({ example: 'Formulario 104 (IVA)' })
  @IsString()
  @MaxLength(80)
  tipoFormulario!: string;

  @ApiProperty({ example: 'Agosto 2026' })
  @IsString()
  @MaxLength(40)
  periodo!: string;

  @ApiProperty({ example: '1792004123001' })
  @IsString()
  @MaxLength(13)
  ruc!: string;

  @ApiProperty({ example: '179200412300112345' })
  @IsString()
  @MaxLength(40)
  numeroAdhesion!: string;

  @ApiProperty({ type: [LineaBorradorSriDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaBorradorSriDto)
  lineas!: LineaBorradorSriDto[];

  @ApiProperty({ example: 'RESULTADO FINAL' })
  @IsString()
  @MaxLength(60)
  resultadoEtiqueta!: string;

  @ApiProperty({ example: '$174.83 USD (A PAGAR)' })
  @IsString()
  @MaxLength(60)
  resultadoValor!: string;

  // Nombre del contribuyente (autoempleado: se usa tanto para "Identificación
  // del empleador" como para "Identificación del trabajador" en el 107).
  @ApiPropertyOptional({ example: 'Juan Pérez' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombreContribuyente?: string;
}
