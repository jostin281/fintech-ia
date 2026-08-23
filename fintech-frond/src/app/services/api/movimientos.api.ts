import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../api-config';
import type { TipoMovimientoApi } from './categorias.api';

export interface MovimientoApi {
  id: number;
  tipo: TipoMovimientoApi;
  monto: string;
  descripcion: string | null;
  fecha: string;
  usuarioId: number;
  categoriaId: number;
  categoria: { id: number; nombre: string; tipo: TipoMovimientoApi };
}

export interface CrearMovimientoApi {
  tipo: TipoMovimientoApi;
  categoriaId: number;
  monto: number;
  descripcion?: string;
  fecha?: string;
}

/** Conecta con /api/movimientos (ingresos y gastos del usuario). */
@Injectable({ providedIn: 'root' })
export class MovimientosApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/movimientos`;

  async listar(): Promise<MovimientoApi[]> {
    const respuesta = await firstValueFrom(
      this.http.get<{ total: number; movimientos: MovimientoApi[] }>(this.base),
    );
    return respuesta.movimientos;
  }

  async crear(dto: CrearMovimientoApi): Promise<MovimientoApi> {
    const respuesta = await firstValueFrom(
      this.http.post<{ mensaje: string; movimiento: MovimientoApi }>(this.base, dto),
    );
    return respuesta.movimiento;
  }

  async eliminar(id: number): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/${id}`));
  }
}
