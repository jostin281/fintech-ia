import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../api-config';

export type TipoNotificacionApi =
  | 'ALERTA_PRESUPUESTO'
  | 'META_AHORRO'
  | 'RECORDATORIO_PAGO'
  | 'RECORDATORIO_MOVIMIENTO'
  | 'RECOMENDACION_IA'
  | 'SISTEMA';

export interface NotificacionApi {
  id: number;
  titulo: string;
  mensaje: string;
  tipo: TipoNotificacionApi;
  referencia: string;
  leida: boolean;
  leidaEn: string | null;
  creadoEn: string;
}

/** Conecta con /api/notificaciones. */
@Injectable({ providedIn: 'root' })
export class NotificacionesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/notificaciones`;

  async sincronizar(): Promise<NotificacionApi[]> {
    const respuesta = await firstValueFrom(
      this.http.post<{ notificaciones: NotificacionApi[] }>(`${this.base}/sincronizar`, {}),
    );
    return respuesta.notificaciones;
  }

  async listar(): Promise<NotificacionApi[]> {
    const respuesta = await firstValueFrom(
      this.http.get<{ notificaciones: NotificacionApi[] }>(this.base),
    );
    return respuesta.notificaciones;
  }

  async marcarLeida(id: number): Promise<void> {
    await firstValueFrom(this.http.patch(`${this.base}/${id}/leer`, {}));
  }

  async marcarTodasLeidas(): Promise<void> {
    await firstValueFrom(this.http.patch(`${this.base}/leer-todas`, {}));
  }

  async eliminar(id: number): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/${id}`));
  }
}
