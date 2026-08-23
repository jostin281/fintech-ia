import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../api-config';

export interface ClaveGeminiApi {
  geminiApiKey: string | null;
}

/**
 * Conecta con /api/usuarios/clave-gemini: permite que cada usuario guarde su
 * propia clave de Google Gemini (Configuración > Asistente IA). Si no hay
 * clave personal, el backend usa GEMINI_API_KEY global o el motor local.
 */
@Injectable({ providedIn: 'root' })
export class UsuariosApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/usuarios`;

  async obtenerClaveGemini(): Promise<string | null> {
    const respuesta = await firstValueFrom(
      this.http.get<ClaveGeminiApi>(`${this.base}/clave-gemini`),
    );
    return respuesta.geminiApiKey;
  }

  async guardarClaveGemini(geminiApiKey: string | null): Promise<string | null> {
    const respuesta = await firstValueFrom(
      this.http.patch<ClaveGeminiApi>(`${this.base}/clave-gemini`, { geminiApiKey }),
    );
    return respuesta.geminiApiKey;
  }
}
