import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../api-config';

export interface ConversacionApi {
  id: number;
  titulo: string;
  creadoEn: string;
  actualizadoEn: string;
  totalMensajes?: number;
}

export interface MensajeAsistenteApi {
  id: number;
  rol: 'USUARIO' | 'ASISTENTE';
  contenido: string;
  origenRespuesta: 'GEMINI' | 'MOTOR_REGLAS' | null;
  creadoEn: string;
}

/**
 * Conecta con /api/asistente-ia. El backend decide si responde con Gemini
 * (si GEMINI_API_KEY está configurada en fintech-back/.env) o con su motor
 * de reglas local; el frontend solo muestra `origenRespuesta` para indicarlo.
 */
@Injectable({ providedIn: 'root' })
export class AsistenteIaApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/asistente-ia`;

  async listarConversaciones(): Promise<ConversacionApi[]> {
    const respuesta = await firstValueFrom(
      this.http.get<{ conversaciones: ConversacionApi[] }>(`${this.base}/conversaciones`),
    );
    return respuesta.conversaciones;
  }

  async crearConversacion(titulo: string): Promise<ConversacionApi> {
    const respuesta = await firstValueFrom(
      this.http.post<{ conversacion: ConversacionApi }>(`${this.base}/conversaciones`, { titulo }),
    );
    return respuesta.conversacion;
  }

  async obtenerConversacion(
    id: number,
  ): Promise<ConversacionApi & { mensajes: MensajeAsistenteApi[] }> {
    const respuesta = await firstValueFrom(
      this.http.get<{ conversacion: ConversacionApi & { mensajes: MensajeAsistenteApi[] } }>(
        `${this.base}/conversaciones/${id}`,
      ),
    );
    return respuesta.conversacion;
  }

  async enviarMensaje(
    conversacionId: number,
    contenido: string,
  ): Promise<{ pregunta: MensajeAsistenteApi; respuesta: MensajeAsistenteApi }> {
    return firstValueFrom(
      this.http.post<{ pregunta: MensajeAsistenteApi; respuesta: MensajeAsistenteApi }>(
        `${this.base}/conversaciones/${conversacionId}/mensajes`,
        { contenido },
      ),
    );
  }
}
