import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

import { ConsultarReporteDto } from './consultar-reporte.dto';

export class ExportarReporteDto extends ConsultarReporteDto {
  // Formato en el que se descargará el reporte.
  @ApiProperty({
    example: 'pdf',
    enum: ['pdf', 'excel'],
    description: 'Formato de exportación permitido',
  })
  @IsIn(['pdf', 'excel'], {
    message: 'formato debe ser pdf o excel',
  })
  formato!: 'pdf' | 'excel';
}
