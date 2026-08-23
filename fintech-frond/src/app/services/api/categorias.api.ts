import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../api-config';

export type TipoMovimientoApi = 'INGRESO' | 'GASTO';

export interface CategoriaApi {
  id: number;
  nombre: string;
  tipo: TipoMovimientoApi;
  activa: boolean;
}

/** Conecta con /api/categorias (catálogo compartido de categorías financieras). */
@Injectable({ providedIn: 'root' })
export class CategoriasApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/categorias`;

  async listar(): Promise<CategoriaApi[]> {
    const respuesta = await firstValueFrom(
      this.http.get<{ categorias: CategoriaApi[] }>(this.base),
    );
    return respuesta.categorias;
  }
}
