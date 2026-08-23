import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../api-config';

const BASE = `${API_BASE_URL}/rdep`;

/* ────────────────────────── Tipos / catálogos ────────────────────────── */

export type EstadoFormularioRdepApi = 'BORRADOR' | 'VALIDADO' | 'GENERADO';

export interface OpcionCatalogoRdepApi {
  valor: string;
  etiqueta: string;
}

export interface PaisCatalogoRdepApi {
  codigo: string;
  nombre: string;
}

export interface CatalogosRdepApi {
  tiposIdentificacionTrabajador: OpcionCatalogoRdepApi[];
  residenciaTrabajador: OpcionCatalogoRdepApi[];
  condicionDiscapacidad: OpcionCatalogoRdepApi[];
  convenioDobleImposicion: OpcionCatalogoRdepApi[];
  sistemaSalarioNeto: OpcionCatalogoRdepApi[];
  tipoEmpleador: OpcionCatalogoRdepApi[];
  enteSeguridadSocial: OpcionCatalogoRdepApi[];
  cargasFamiliares: OpcionCatalogoRdepApi[];
  paises: PaisCatalogoRdepApi[];
}

/** Payload que acepta tanto crear (POST) como actualizar (PATCH, todo opcional). */
export interface GuardarFormularioRdepApi {
  periodoFiscal?: number;
  tipoEmpleador?: string;
  enteSeguridadSocial?: string;
  tipoIdentificacionTrabajador?: string;
  numeroIdentificacionTrabajador?: string;
  apellidosTrabajador?: string;
  nombresTrabajador?: string;
  codigoEstablecimiento?: string;
  residenciaTrabajador?: string;
  paisResidenciaTrabajador?: string;
  aplicaConvenioDobleImposicion?: string;
  condicionDiscapacidad?: string;
  porcentajeDiscapacidad?: number | null;
  beneficioGalapagos?: boolean;
  enfermedadCatastrofica?: boolean;
  cargasFamiliares?: number;
  sueldosSalariosIngresosGravados?: number;
  otrosIngresosGravados?: number;
  participacionUtilidades?: number;
  ingresosOtrosEmpleadores?: number;
  decimoTercerSueldo?: number;
  decimoCuartoSueldo?: number;
  fondoReserva?: number;
  otrosIngresosNoGravados?: number;
  impuestoRentaAsumidoEmpleador?: number;
  sistemaSalarioNeto?: string;
  aportePersonalEsteEmpleador?: number;
  aportePersonalOtrosEmpleadores?: number;
  gastoVivienda?: number;
  gastoSalud?: number;
  gastoEducacion?: number;
  gastoAlimentacion?: number;
  gastoVestimenta?: number;
  gastoTurismo?: number;
  exoneracionDiscapacidad?: number;
  exoneracionTerceraEdad?: number;
  impuestoRetenidoAsumidoOtrosEmpleadores?: number;
  impuestoAsumidoEsteEmpleador?: number;
  canastaBasicaMensual?: number;
}

export interface FormularioRdepApi extends Required<Omit<GuardarFormularioRdepApi, 'porcentajeDiscapacidad'>> {
  id: number;
  estado: EstadoFormularioRdepApi;
  porcentajeDiscapacidad: number | null;
  baseImponibleGravada: string;
  impuestoRentaCausado: string;
  rebajaGastosPersonales: string;
  impuestoRentaCausadoDespuesRebaja: string;
  impuestoRetenidoTrabajadorEsteEmpleador: string;
  validadoEn: string | null;
  generadoEn: string | null;
  usuarioGeneradorId: number | null;
  creadoEn: string;
  actualizadoEn: string;
  usuarioId: number;
  perfilTributarioId: number;
}

export interface ErrorValidacionRdepApi {
  campo: string;
  valorIngresado: string;
  motivo: string;
  comoCorregirlo: string;
}

export interface ResultadoValidacionRdepApi {
  valido: boolean;
  totalErrores: number;
  errores: ErrorValidacionRdepApi[];
}

/** Plantilla para prellenar un formulario nuevo con los datos del período más reciente ya registrado. */
export type PlantillaRdepApi =
  | { encontrado: false }
  | { encontrado: true; periodoFiscalOrigen: number; plantilla: Omit<GuardarFormularioRdepApi, 'periodoFiscal'> };

export interface HistorialFormularioRdepApi {
  id: number;
  accion: string;
  detalle: string | null;
  creadoEn: string;
  formularioRdepId: number;
  usuarioId: number;
}

@Injectable({ providedIn: 'root' })
export class RdepApiService {
  private readonly http = inject(HttpClient);

  async obtenerCatalogos(): Promise<CatalogosRdepApi> {
    return firstValueFrom(this.http.get<CatalogosRdepApi>(`${BASE}/catalogos`));
  }

  /** Datos del período fiscal más reciente del usuario, para prellenar un formulario nuevo. */
  async obtenerPlantilla(): Promise<PlantillaRdepApi> {
    return firstValueFrom(this.http.get<PlantillaRdepApi>(`${BASE}/plantilla`));
  }

  async listar(periodoFiscal?: number): Promise<{ total: number; formularios: FormularioRdepApi[] }> {
    const params = periodoFiscal ? { periodoFiscal: String(periodoFiscal) } : undefined;
    return firstValueFrom(
      this.http.get<{ total: number; formularios: FormularioRdepApi[] }>(BASE, { params }),
    );
  }

  async obtener(id: number): Promise<FormularioRdepApi> {
    return firstValueFrom(this.http.get<FormularioRdepApi>(`${BASE}/${id}`));
  }

  async crear(dto: GuardarFormularioRdepApi): Promise<{ mensaje: string; formulario: FormularioRdepApi }> {
    return firstValueFrom(
      this.http.post<{ mensaje: string; formulario: FormularioRdepApi }>(BASE, dto),
    );
  }

  async actualizar(
    id: number,
    dto: GuardarFormularioRdepApi,
  ): Promise<{ mensaje: string; formulario: FormularioRdepApi }> {
    return firstValueFrom(
      this.http.patch<{ mensaje: string; formulario: FormularioRdepApi }>(`${BASE}/${id}`, dto),
    );
  }

  async eliminar(id: number): Promise<{ mensaje: string }> {
    return firstValueFrom(this.http.delete<{ mensaje: string }>(`${BASE}/${id}`));
  }

  async validar(id: number): Promise<ResultadoValidacionRdepApi> {
    return firstValueFrom(
      this.http.post<ResultadoValidacionRdepApi>(`${BASE}/${id}/validar`, {}),
    );
  }

  async generar(id: number): Promise<{ mensaje: string; formulario: FormularioRdepApi }> {
    return firstValueFrom(
      this.http.post<{ mensaje: string; formulario: FormularioRdepApi }>(`${BASE}/${id}/generar`, {}),
    );
  }

  async obtenerHistorial(
    id: number,
  ): Promise<{ total: number; historial: HistorialFormularioRdepApi[] }> {
    return firstValueFrom(
      this.http.get<{ total: number; historial: HistorialFormularioRdepApi[] }>(
        `${BASE}/${id}/historial`,
      ),
    );
  }

  /** Descarga y dispara el PDF de vista previa / documento final del Formulario 107. */
  async descargarPdf(id: number, periodoFiscal: number): Promise<void> {
    const blob = await firstValueFrom(
      this.http.get(`${BASE}/${id}/pdf`, { responseType: 'blob' }),
    );
    this.descargarBlob(blob, `formulario-107-rdep-${periodoFiscal}.pdf`);
  }

  /** Descarga el anexo RDEP oficial (.xlsx) — solo disponible si el formulario ya está GENERADO. */
  async descargarAnexoExcel(id: number, periodoFiscal: number): Promise<void> {
    const blob = await firstValueFrom(
      this.http.get(`${BASE}/${id}/anexo-excel`, { responseType: 'blob' }),
    );
    this.descargarBlob(blob, `anexo-rdep-${periodoFiscal}.xlsx`);
  }

  private descargarBlob(blob: Blob, nombreArchivo: string): void {
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
