import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, Matches } from 'class-validator';

export class ConsultarReporteDto {
  // Fecha usada para determinar el día, semana, mes o año del reporte.
  @ApiPropertyOptional({
    example: '2026-08-10',
    description:
      'Fecha de referencia en formato YYYY-MM-DD. Si no se envía, se utiliza la fecha actual de Ecuador.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaReferencia debe tener el formato YYYY-MM-DD',
  })
  @IsDateString(
    {
      strict: true,
      strictSeparator: true,
    },
    {
      message: 'fechaReferencia debe ser una fecha válida',
    },
  )
  fechaReferencia?: string;
}
