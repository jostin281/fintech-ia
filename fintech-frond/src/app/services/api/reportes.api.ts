import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../api-config';

export type TipoReporteApi = 'diario' | 'semanal' | 'mensual' | 'anual';

export interface ResultadoReporteApi {
  tipo: 'DIARIO' | 'SEMANAL' | 'MENSUAL' | 'ANUAL';
  periodo: { fechaDesde: string; fechaHasta: string };
  resumen: {
    ingresos: string;
    gastos: string;
    balance: string;
    porcentajeAhorro: number;
    estado: 'SUPERAVIT' | 'EQUILIBRIO' | 'DEFICIT';
    cantidadIngresos: number;
    cantidadGastos: number;
    totalMovimientos: number;
  };
  categorias: {
    ingresos: { categoriaId: number; nombre: string; monto: string; porcentaje: number; cantidadMovimientos: number }[];
    gastos: { categoriaId: number; nombre: string; monto: string; porcentaje: number; cantidadMovimientos: number }[];
  };
  evolucion: {
    orden: number;
    etiqueta: string;
    periodo: { fechaDesde: string; fechaHasta: string };
    ingresos: string;
    gastos: string;
    balance: string;
    cantidadMovimientos: number;
  }[];
  movimientos: {
    id: number;
    tipo: 'INGRESO' | 'GASTO';
    monto: string;
    descripcion: string | null;
    fecha: string;
    categoria: { id: number; nombre: string };
  }[];
}

/** Conecta con /api/reportes (diario, semanal, mensual, anual + exportación real en PDF/Excel). */
@Injectable({ providedIn: 'root' })
export class ReportesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/reportes`;

  async obtener(tipo: TipoReporteApi, fechaReferencia?: string): Promise<ResultadoReporteApi> {
    const params: Record<string, string> = {};
    if (fechaReferencia) params['fechaReferencia'] = fechaReferencia;
    return firstValueFrom(
      this.http.get<ResultadoReporteApi>(`${this.base}/${tipo}`, { params }),
    );
  }

  /** Descarga el reporte ya generado por el backend (PDF o Excel real) y dispara la descarga en el navegador. */
  async exportarYDescargar(
    tipo: TipoReporteApi,
    formato: 'pdf' | 'excel',
    fechaReferencia?: string,
  ): Promise<void> {
    const params: Record<string, string> = { formato };
    if (fechaReferencia) params['fechaReferencia'] = fechaReferencia;

    const blob = await firstValueFrom(
      this.http.get(`${this.base}/${tipo}/exportar`, { params, responseType: 'blob' }),
    );

    const extension = formato === 'pdf' ? 'pdf' : 'xlsx';
    const nombreArchivo = `reporte-${tipo}-${new Date().toISOString().slice(0, 10)}.${extension}`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nombreArchivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
