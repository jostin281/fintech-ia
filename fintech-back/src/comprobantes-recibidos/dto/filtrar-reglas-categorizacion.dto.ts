import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

import { AlcanceRegla } from '../interfaces/alcance-regla.enum';

export class FiltrarReglasCategorizacionDto {
  @ApiPropertyOptional({
    description:
      'Filtra por alcance; sin filtro se listan las reglas globales y las personales del usuario autenticado',
    enum: AlcanceRegla,
    enumName: 'AlcanceRegla',
    example: AlcanceRegla.PERSONAL,
  })
  @IsOptional()
  @IsEnum(AlcanceRegla, { message: 'El alcance debe ser GLOBAL o PERSONAL' })
  alcance?: AlcanceRegla;
}
