import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../api-config';
import type { TipoMovimientoApi } from './categorias.api';

export type EstadoPresupuestoApi =
  | 'SIN_CONSUMO'
  | 'DENTRO_DEL_LIMITE'
  | 'EN_ALERTA'
  | 'LIMITE_ALCANZADO'
  | 'EXCEDIDO';

export interface PresupuestoApi {
  id: number;
  montoLimite: string;
  montoGastado: string;
  saldoDisponible: string;
  porcentajeUtilizado: number;
  porcentajeAlerta: number;
  estado: EstadoPresupuestoApi;
  mes: number;
  anio: number;
  activo: boolean;
  categoria: { id: number; nombre: string; tipo: TipoMovimientoApi };
}

export interface CrearPresupuestoApi {
  categoriaId: number;
  montoLimite: number;
  mes: number;
  anio: number;
  porcentajeAlerta?: number;
}

/** Conecta con /api/presupuestos (límites mensuales de gasto por categoría). */
@Injectable({ providedIn: 'root' })
export class PresupuestosApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/presupuestos`;

  async listar(mes?: number, anio?: number): Promise<PresupuestoApi[]> {
    const params: Record<string, string> = {};
    if (mes !== undefined && anio !== undefined) {
      params['mes'] = String(mes);
      params['anio'] = String(anio);
    }
    const respuesta = await firstValueFrom(
      this.http.get<{ presupuestos: PresupuestoApi[] }>(this.base, { params }),
    );
    return respuesta.presupuestos;
  }

  async crear(dto: CrearPresupuestoApi): Promise<PresupuestoApi> {
    const respuesta = await firstValueFrom(
      this.http.post<{ mensaje: string; presupuesto: PresupuestoApi }>(this.base, dto),
    );
    return respuesta.presupuesto;
  }

  async actualizar(
    id: number,
    dto: { montoLimite?: number; porcentajeAlerta?: number },
  ): Promise<PresupuestoApi> {
    const respuesta = await firstValueFrom(
      this.http.patch<{ mensaje: string; presupuesto: PresupuestoApi }>(`${this.base}/${id}`, dto),
    );
    return respuesta.presupuesto;
  }

  async eliminar(id: number): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/${id}`));
  }
}
