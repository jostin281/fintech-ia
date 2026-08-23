import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../api-config';

const BASE = `${API_BASE_URL}/comprobantes-recibidos`;

/* ────────────────────────── Comprobantes recibidos ────────────────────────── */

export type EstadoComprobanteRecibidoApi =
  | 'PENDIENTE'
  | 'PROCESANDO'
  | 'PROCESADO'
  | 'ERROR_XML';

export type EstadoResultadoImportacionApi =
  | 'PROCESADO'
  | 'DUPLICADO'
  | 'NO_RECONOCIDO'
  | 'ERROR_XML';

export type MetodoClasificacionDetalleApi = 'REGLA' | 'MANUAL' | 'IA' | 'PROVEEDOR';

export type AlcanceReglaApi = 'GLOBAL' | 'PERSONAL';

export interface ProveedorResumenApi {
  id: number;
  razonSocial: string;
  ruc: string;
}

export interface ComprobanteRecibidoResumenApi {
  id: number;
  estado: EstadoComprobanteRecibidoApi;
  numero: string;
  rucEmisor: string;
  razonSocialEmisor: string;
  proveedor: ProveedorResumenApi;
  fechaEmision: string;
  subtotalSinImpuestos: string;
  iva: string;
  importeTotal: string;
  /** "Sin categorizar", "Múltiples" o el nombre de la única categoría de sus líneas. */
  categoria: string;
}

export interface DetalleComprobanteRecibidoApi {
  id: number;
  codigoPrincipal: string | null;
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  descuento: string;
  baseImponible: string;
  tarifaCodigo: string;
  tarifaPorcentaje: string;
  valorIva: string;
  total: string;
  metodoClasificacion: MetodoClasificacionDetalleApi | null;
  confianza: string | null;
  categoriaId: number | null;
  categoria: { id: number; nombre: string } | null;
  comprobanteRecibidoId: number;
  reglaCategorizacionId: number | null;
  movimientoId: number | null;
}

export interface ComprobanteRecibidoCompletoApi {
  id: number;
  estado: EstadoComprobanteRecibidoApi;
  mensajeError: string | null;
  claveAcceso: string;
  rucEmisor: string;
  razonSocialEmisor: string;
  nombreComercialEmisor: string | null;
  establecimiento: string;
  puntoEmision: string;
  secuencial: string;
  fechaEmision: string;
  subtotalSinImpuestos: string;
  totalDescuento: string;
  iva: string;
  importeTotal: string;
  archivoNombre: string | null;
  descargadoEn: string;
  procesadoEn: string | null;
  proveedor: { id: number; ruc: string; razonSocial: string; nombreComercial: string | null };
  detalles: DetalleComprobanteRecibidoApi[];
}

export interface ResultadoImportacionComprobanteApi {
  archivo: string;
  estado: EstadoResultadoImportacionApi;
  comprobanteId?: number;
  detalle?: string;
}

export interface ResumenImportacionComprobantesApi {
  mensaje: string;
  procesados: number;
  duplicados: number;
  noReconocidos: number;
  errores: number;
  resultados: ResultadoImportacionComprobanteApi[];
}

export interface BaseIvaApi {
  tarifaCodigo: string;
  tarifaPorcentaje: string;
  base: string;
  iva: string;
}

export interface DistribucionCategoriaApi {
  categoriaId: number | null;
  categoria: string;
  total: string;
  porcentaje: string;
}

export interface DesgloseComprobanteApi {
  comprobante: ComprobanteRecibidoCompletoApi;
  basesIva: BaseIvaApi[];
  distribucionCategorias: DistribucionCategoriaApi[];
}

export interface FiltrosComprobantesRecibidosApi {
  estado?: EstadoComprobanteRecibidoApi;
  proveedorId?: number;
  categoriaId?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  q?: string;
}

export interface ActualizarCategoriaDetalleApi {
  categoriaId: number;
  crearRegla?: boolean;
  palabraClave?: string;
}

@Injectable({ providedIn: 'root' })
export class ComprobantesRecibidosApiService {
  private readonly http = inject(HttpClient);
  private readonly base = BASE;

  async listar(
    filtros: FiltrosComprobantesRecibidosApi = {},
  ): Promise<ComprobanteRecibidoResumenApi[]> {
    const params: Record<string, string> = {};
    if (filtros.estado) params['estado'] = filtros.estado;
    if (filtros.proveedorId) params['proveedorId'] = String(filtros.proveedorId);
    if (filtros.categoriaId) params['categoriaId'] = String(filtros.categoriaId);
    if (filtros.fechaDesde) params['fechaDesde'] = filtros.fechaDesde;
    if (filtros.fechaHasta) params['fechaHasta'] = filtros.fechaHasta;
    if (filtros.q) params['q'] = filtros.q;

    const respuesta = await firstValueFrom(
      this.http.get<{ total: number; comprobantes: ComprobanteRecibidoResumenApi[] }>(
        this.base,
        { params },
      ),
    );
    return respuesta.comprobantes;
  }

  async obtenerUno(id: number): Promise<ComprobanteRecibidoCompletoApi> {
    const respuesta = await firstValueFrom(
      this.http.get<{ comprobante: ComprobanteRecibidoCompletoApi }>(`${this.base}/${id}`),
    );
    return respuesta.comprobante;
  }

  /**
   * Sube un lote de XML de facturas de compra/gasto descargadas por el
   * propio usuario desde SRI en Línea. No se envía ni se pide ninguna
   * credencial del portal del SRI.
   */
  async importar(archivos: File[]): Promise<ResumenImportacionComprobantesApi> {
    const formData = new FormData();
    for (const archivo of archivos) {
      formData.append('archivos', archivo, archivo.name);
    }

    return firstValueFrom(
      this.http.post<ResumenImportacionComprobantesApi>(`${this.base}/importar`, formData),
    );
  }

  async obtenerXml(id: number): Promise<Blob> {
    return firstValueFrom(this.http.get(`${this.base}/${id}/xml`, { responseType: 'blob' }));
  }

  async obtenerDesglose(id: number): Promise<DesgloseComprobanteApi> {
    return firstValueFrom(this.http.get<DesgloseComprobanteApi>(`${this.base}/${id}/desglose`));
  }

  async actualizarCategoriaDetalle(
    comprobanteId: number,
    detalleId: number,
    dto: ActualizarCategoriaDetalleApi,
  ): Promise<DetalleComprobanteRecibidoApi> {
    const respuesta = await firstValueFrom(
      this.http.patch<{ mensaje: string; detalle: DetalleComprobanteRecibidoApi }>(
        `${this.base}/${comprobanteId}/detalles/${detalleId}/categoria`,
        dto,
      ),
    );
    return respuesta.detalle;
  }
}

/* ────────────────────────── Proveedores ────────────────────────── */

export interface ProveedorConTotalesApi {
  id: number;
  ruc: string;
  razonSocial: string;
  nombreComercial: string | null;
  activo: boolean;
  totalComprobantes: number;
  totalGastado: string;
  ultimaCompra: string | null;
}

@Injectable({ providedIn: 'root' })
export class ProveedoresApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${BASE}/proveedores`;

  async listar(): Promise<ProveedorConTotalesApi[]> {
    const respuesta = await firstValueFrom(
      this.http.get<{ total: number; proveedores: ProveedorConTotalesApi[] }>(this.base),
    );
    return respuesta.proveedores;
  }

  async obtenerUno(id: number): Promise<ProveedorConTotalesApi> {
    const respuesta = await firstValueFrom(
      this.http.get<{ proveedor: ProveedorConTotalesApi }>(`${this.base}/${id}`),
    );
    return respuesta.proveedor;
  }
}

/* ────────────────────────── Reglas de categorización ────────────────────────── */

export interface ReglaCategorizacionApi {
  id: number;
  palabraClave: string;
  prioridad: number;
  activa: boolean;
  origen: 'MANUAL' | 'CORRECCION';
  alcance: AlcanceReglaApi;
  categoria: { id: number; nombre: string };
}

export interface CrearReglaCategorizacionApi {
  palabraClave: string;
  categoriaId: number;
  alcance: AlcanceReglaApi;
  prioridad?: number;
  activa?: boolean;
}

export type ActualizarReglaCategorizacionApi = Partial<
  Omit<CrearReglaCategorizacionApi, 'alcance'>
>;

@Injectable({ providedIn: 'root' })
export class ReglasCategorizacionApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${BASE}/reglas`;

  async listar(alcance?: AlcanceReglaApi): Promise<ReglaCategorizacionApi[]> {
    const params: Record<string, string> = {};
    if (alcance) params['alcance'] = alcance;
    const respuesta = await firstValueFrom(
      this.http.get<{ total: number; reglas: ReglaCategorizacionApi[] }>(this.base, { params }),
    );
    return respuesta.reglas;
  }

  async crear(dto: CrearReglaCategorizacionApi): Promise<ReglaCategorizacionApi> {
    const respuesta = await firstValueFrom(
      this.http.post<{ mensaje: string; regla: ReglaCategorizacionApi }>(this.base, dto),
    );
    return respuesta.regla;
  }

  async actualizar(
    id: number,
    dto: ActualizarReglaCategorizacionApi,
  ): Promise<ReglaCategorizacionApi> {
    const respuesta = await firstValueFrom(
      this.http.patch<{ mensaje: string; regla: ReglaCategorizacionApi }>(
        `${this.base}/${id}`,
        dto,
      ),
    );
    return respuesta.regla;
  }

  async eliminar(id: number): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/${id}`));
  }
}
