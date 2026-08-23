import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../api-config';

export type EstadoMetaApi = 'SIN_APORTES' | 'EN_PROGRESO' | 'COMPLETADA' | 'VENCIDA';

export interface MetaAhorroApi {
  id: number;
  nombre: string;
  montoObjetivo: string;
  montoAhorrado: string;
  montoRestante: string;
  porcentajeAvance: number;
  estado: EstadoMetaApi;
  fechaObjetivo: string;
  diasRestantes: number;
  activo: boolean;
}

export interface CrearMetaAhorroApi {
  nombre: string;
  montoObjetivo: number;
  fechaObjetivo: string;
}

/** Conecta con /api/metas-ahorro. */
@Injectable({ providedIn: 'root' })
export class MetasAhorroApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/metas-ahorro`;

  async listar(): Promise<MetaAhorroApi[]> {
    const respuesta = await firstValueFrom(
      this.http.get<{ metas: MetaAhorroApi[] }>(this.base),
    );
    return respuesta.metas;
  }

  async crear(dto: CrearMetaAhorroApi): Promise<MetaAhorroApi> {
    const respuesta = await firstValueFrom(
      this.http.post<{ mensaje: string; meta: MetaAhorroApi }>(this.base, dto),
    );
    return respuesta.meta;
  }

  async registrarAporte(metaId: number, monto: number): Promise<void> {
    await firstValueFrom(this.http.post(`${this.base}/${metaId}/aportes`, { monto }));
  }

  async eliminar(id: number): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/${id}`));
  }
}
