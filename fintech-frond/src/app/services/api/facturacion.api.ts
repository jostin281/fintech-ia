import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../api-config';

const BASE = `${API_BASE_URL}/facturacion`;

/* ────────────────────────── Perfil tributario ────────────────────────── */

export type TipoContribuyenteApi = 'PERSONA_NATURAL' | 'SOCIEDAD';
export type RegimenTributarioApi = 'GENERAL' | 'RIMPE_NEGOCIO_POPULAR' | 'RIMPE_EMPRENDEDOR';
export type TipoIdentificacionPerfilApi = 'RUC' | 'CEDULA';

export interface PerfilTributarioApi {
  id: number;
  ruc: string;
  razonSocial: string;
  nombreComercial: string | null;
  direccionMatriz: string;
  tipoContribuyente: TipoContribuyenteApi;
  regimenTributario: RegimenTributarioApi;
  obligadoContabilidad: boolean;
  codigoContribuyenteEspecial: string | null;
  codigoAgenteRetencion: string | null;
  establecimiento: string;
  puntoEmision: string;
  ambienteSri: 'PRUEBAS' | 'PRODUCCION';
  activo: boolean;
}

export interface CrearPerfilTributarioApi {
  /**
   * Tipo de identificación ingresada en "ruc": RUC completo (13 dígitos) o
   * cédula (10 dígitos). Si se elige CEDULA, el backend completa
   * automáticamente el RUC de persona natural agregando "001". Si se omite,
   * se asume RUC.
   */
  tipoIdentificacion?: TipoIdentificacionPerfilApi;
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  direccionMatriz: string;
  tipoContribuyente: TipoContribuyenteApi;
  regimenTributario: RegimenTributarioApi;
  obligadoContabilidad?: boolean;
  codigoContribuyenteEspecial?: string;
  codigoAgenteRetencion?: string;
  establecimiento?: string;
  puntoEmision?: string;
}

@Injectable({ providedIn: 'root' })
export class PerfilTributarioApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${BASE}/perfil-tributario`;

  /** Devuelve null si el usuario todavía no tiene perfil (404 del backend). */
  async obtener(): Promise<PerfilTributarioApi | null> {
    try {
      const respuesta = await firstValueFrom(
        this.http.get<{ perfilTributario: PerfilTributarioApi }>(this.base),
      );
      return respuesta.perfilTributario;
    } catch {
      return null;
    }
  }

  async crear(dto: CrearPerfilTributarioApi): Promise<PerfilTributarioApi> {
    const respuesta = await firstValueFrom(
      this.http.post<{ perfilTributario: PerfilTributarioApi }>(this.base, dto),
    );
    return respuesta.perfilTributario;
  }

  async actualizar(dto: Partial<CrearPerfilTributarioApi>): Promise<PerfilTributarioApi> {
    const respuesta = await firstValueFrom(
      this.http.patch<{ perfilTributario: PerfilTributarioApi }>(this.base, dto),
    );
    return respuesta.perfilTributario;
  }
}

/* ────────────────────────── Firma electrónica ────────────────────────── */

export interface FirmaElectronicaApi {
  id: number;
  nombreArchivo: string;
  numeroSerie: string;
  emisorCertificado: string;
  tipoClave: string;
  validoHasta: string;
  diasParaCaducar: number;
  proximaACaducar: boolean;
  activo: boolean;
}

@Injectable({ providedIn: 'root' })
export class FirmaElectronicaApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${BASE}/firma-electronica`;

  async obtenerEstado(): Promise<FirmaElectronicaApi | null> {
    try {
      const respuesta = await firstValueFrom(
        this.http.get<{ firmaElectronica: FirmaElectronicaApi }>(this.base),
      );
      return respuesta.firmaElectronica;
    } catch {
      return null;
    }
  }

  async guardar(archivo: File, clave: string): Promise<FirmaElectronicaApi> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    formData.append('clave', clave);
    const respuesta = await firstValueFrom(
      this.http.put<{ firmaElectronica: FirmaElectronicaApi }>(this.base, formData),
    );
    return respuesta.firmaElectronica;
  }

  async desactivar(): Promise<void> {
    await firstValueFrom(this.http.delete(this.base));
  }
}

/* ────────────────────────── Clientes ────────────────────────── */

export type TipoIdentificacionSriApi =
  | 'RUC'
  | 'CEDULA'
  | 'PASAPORTE'
  | 'CONSUMIDOR_FINAL'
  | 'IDENTIFICACION_EXTERIOR';

export interface ClienteFacturacionApi {
  id: number;
  tipoIdentificacion: TipoIdentificacionSriApi;
  identificacion: string;
  razonSocial: string;
  correo: string | null;
  direccion: string | null;
  telefono: string | null;
  activo: boolean;
}

export interface CrearClienteApi {
  tipoIdentificacion: TipoIdentificacionSriApi;
  identificacion: string;
  razonSocial: string;
  correo?: string;
  direccion?: string;
  telefono?: string;
}

@Injectable({ providedIn: 'root' })
export class ClientesFacturacionApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${BASE}/clientes`;

  async listar(): Promise<ClienteFacturacionApi[]> {
    const respuesta = await firstValueFrom(
      this.http.get<{ clientes: ClienteFacturacionApi[] }>(this.base),
    );
    return respuesta.clientes;
  }

  async crear(dto: CrearClienteApi): Promise<ClienteFacturacionApi> {
    const respuesta = await firstValueFrom(
      this.http.post<{ cliente: ClienteFacturacionApi }>(this.base, dto),
    );
    return respuesta.cliente;
  }

  async eliminar(id: number): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/${id}`));
  }
}

/* ────────────────────────── Productos y servicios ────────────────────────── */

export type TarifaIvaProductoApi = 'CERO' | 'QUINCE';

export interface ProductoServicioApi {
  id: number;
  codigoPrincipal: string;
  descripcion: string;
  precioUnitario: string;
  tarifaIva: TarifaIvaProductoApi;
  activo: boolean;
}

export interface CrearProductoServicioApi {
  codigoPrincipal: string;
  descripcion: string;
  precioUnitario: string;
  tarifaIva: TarifaIvaProductoApi;
}

@Injectable({ providedIn: 'root' })
export class ProductosServiciosApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${BASE}/productos-servicios`;

  async listar(): Promise<ProductoServicioApi[]> {
    const respuesta = await firstValueFrom(
      this.http.get<{ productosServicios: ProductoServicioApi[] }>(this.base),
    );
    return respuesta.productosServicios;
  }

  async crear(dto: CrearProductoServicioApi): Promise<ProductoServicioApi> {
    const respuesta = await firstValueFrom(
      this.http.post<{ productoServicio: ProductoServicioApi }>(this.base, dto),
    );
    return respuesta.productoServicio;
  }

  async eliminar(id: number): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/${id}`));
  }
}

/* ────────────────────────── Facturas (emisión SRI) ────────────────────────── */

export type EstadoFacturaApi =
  | 'BORRADOR'
  | 'FIRMADA'
  | 'RECIBIDA'
  | 'AUTORIZADA'
  | 'DEVUELTA'
  | 'NO_AUTORIZADA'
  | 'ANULADA_LOCAL'
  | 'ERROR';

export interface FacturaApi {
  id: number;
  estado: EstadoFacturaApi;
  numero: string | null;
  claveAcceso: string | null;
  fechaEmision: string;
  formaPago: string;
  observacion: string | null;
  emisor: {
    ruc: string;
    razonSocial: string;
    nombreComercial: string | null;
    direccionMatriz: string;
    regimenTributario: string;
    obligadoContabilidad: boolean;
    ambienteSri: string;
  };
  comprador: {
    tipoIdentificacion: string;
    identificacion: string;
    razonSocial: string;
    correo: string | null;
    direccion: string | null;
  };
  totales: {
    subtotalCero: string;
    subtotalQuince: string;
    totalSinImpuestos: string;
    totalDescuento: string;
    iva: string;
    importeTotal: string;
  };
  numeroAutorizacion: string | null;
  fechaAutorizacion: string | null;
  mensajesSri: unknown;
  detalles: Array<{
    id: number;
    productoServicioId: number;
    codigoPrincipal: string;
    descripcion: string;
    cantidad: string;
    precioUnitario: string;
    descuento: string;
    tarifaIva: string;
    baseImponible: string;
    valorIva: string;
    total: string;
  }>;
  creadoEn: string;
}

export interface CrearFacturaApi {
  clienteId: number;
  fechaEmision?: string;
  formaPago?: string;
  observacion?: string;
  detalles: Array<{ productoServicioId: number; cantidad: string; descuento?: string }>;
}

@Injectable({ providedIn: 'root' })
export class FacturasApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${BASE}/facturas`;

  async listar(estado?: EstadoFacturaApi): Promise<FacturaApi[]> {
    const params: Record<string, string> = {};
    if (estado) params['estado'] = estado;
    const respuesta = await firstValueFrom(
      this.http.get<{ total: number; facturas: FacturaApi[] }>(this.base, { params }),
    );
    return respuesta.facturas;
  }

  async obtenerUna(id: number): Promise<FacturaApi> {
    const respuesta = await firstValueFrom(
      this.http.get<{ factura: FacturaApi }>(`${this.base}/${id}`),
    );
    return respuesta.factura;
  }

  async crear(dto: CrearFacturaApi): Promise<FacturaApi> {
    const respuesta = await firstValueFrom(
      this.http.post<{ mensaje: string; factura: FacturaApi }>(this.base, dto),
    );
    return respuesta.factura;
  }

  async anularBorrador(id: number): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/${id}`));
  }

  /** Asigna secuencial, firma con el .p12 registrado y envía al SRI (ambiente de pruebas o producción, ver .env). */
  async emitir(id: number): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.base}/${id}/emitir`, {}));
  }

  async consultarSri(id: number): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.base}/${id}/consultar-sri`, {}));
  }

  async descargarXml(id: number): Promise<Blob> {
    return firstValueFrom(this.http.get(`${this.base}/${id}/xml`, { responseType: 'blob' }));
  }

  async descargarRide(id: number): Promise<Blob> {
    return firstValueFrom(this.http.get(`${this.base}/${id}/ride`, { responseType: 'blob' }));
  }
}

/* ────────────────────────── Retenciones recibidas ────────────────────────── */

export interface RetencionRecibidaApi {
  id: number;
  tipo: 'RENTA' | 'IVA';
  emisorIdentificacion: string;
  numeroComprobante: string;
  fechaEmision: string;
  baseImponible: string;
  porcentaje: string;
  valor: string;
  facturaId: number | null;
  observacion: string | null;
}

export interface CrearRetencionRecibidaApi {
  tipo: 'RENTA' | 'IVA';
  emisorIdentificacion: string;
  numeroComprobante: string;
  fechaEmision: string;
  baseImponible: string;
  porcentaje: string;
  valor: string;
  facturaId?: number;
  observacion?: string;
}

@Injectable({ providedIn: 'root' })
export class RetencionesRecibidasApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${BASE}/retenciones-recibidas`;

  async listar(): Promise<RetencionRecibidaApi[]> {
    const respuesta = await firstValueFrom(
      this.http.get<{ retenciones: RetencionRecibidaApi[] }>(this.base),
    );
    return respuesta.retenciones;
  }

  async crear(dto: CrearRetencionRecibidaApi): Promise<RetencionRecibidaApi> {
    const respuesta = await firstValueFrom(
      this.http.post<{ retencion: RetencionRecibidaApi }>(this.base, dto),
    );
    return respuesta.retencion;
  }

  async eliminar(id: number): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/${id}`));
  }
}

/* ────────────────────────── Resumen tributario y renta ────────────────────────── */

export interface ResumenTributarioApi {
  anio: number;
  ingresosTributarios: {
    facturasAutorizadas: number;
    totalSinImpuestos: string;
    ivaGenerado: string;
    totalFacturado: string;
  };
  flujoFintech: {
    movimientosConsiderados: number;
    ingresos: string;
    gastos: string;
    flujoNeto: string;
  };
  clasificacionTributariaFintech: {
    ingresosGravadosMarcados: string;
    ingresosExentosMarcados: string;
    costosGastosDeducibles: string;
    gastosPersonales: string;
    gastosNoDeducibles: string;
    montoIgnorado: string;
    gastosPersonalesPorCategoria: Record<string, string>;
  };
  creditosPorRetenciones: { renta: string; iva: string };
  advertencias: string[];
}

export interface CalcularImpuestoRentaApi {
  otrosIngresosGravados?: number;
  aporteIess?: number;
  otrasDeducciones?: number;
  cargasFamiliares?: number;
  enfermedadCatastrofica?: boolean;
  canastaBasicaMensual?: number;
  otrosCreditosTributarios?: number;
}

export type TratamientoTributarioApi =
  | 'INGRESO_GRAVADO'
  | 'INGRESO_EXENTO'
  | 'COSTO_GASTO_DEDUCIBLE'
  | 'GASTO_PERSONAL'
  | 'NO_DEDUCIBLE'
  | 'IGNORAR';

/** Prellenado del Formulario 104 (IVA) de un mes, calculado con datos ya registrados en Fintech. */
export interface PrellenadoFormulario104Api {
  periodo: { anio: number; mes: number };
  ventasGravadas15: string;
  ventasGravadas0: string;
  impuestoGeneradoVentas: string;
  comprasGravadas15: string;
  retencionesIvaRecibidas: string;
  fuentes: {
    facturasEmitidasConsideradas: number;
    comprobantesRecibidosConsiderados: number;
    retencionesConsideradas: number;
  };
  advertencia: string;
}

/* ── Borradores de formularios SRI (104/103/102): PDF real generado por el backend ── */

export interface LineaBorradorSriApi {
  etiqueta: string;
  valor: string;
}

export interface GenerarBorradorSriApi {
  tipoFormulario: string;
  periodo: string;
  ruc: string;
  numeroAdhesion: string;
  lineas: LineaBorradorSriApi[];
  resultadoEtiqueta: string;
  resultadoValor: string;
  /** Nombre del contribuyente (autoempleado): se usa como identificación de empleador y trabajador en el 107. */
  nombreContribuyente?: string;
}

@Injectable({ providedIn: 'root' })
export class ResumenTributarioApiService {
  private readonly http = inject(HttpClient);
  private readonly base = BASE;

  async configurarCategoria(
    categoriaId: number,
    tratamiento: TratamientoTributarioApi,
    categoriaGastoPersonal?: string,
  ): Promise<void> {
    await firstValueFrom(
      this.http.put(`${this.base}/configuracion-categorias`, {
        categoriaId,
        tratamiento,
        categoriaGastoPersonal,
      }),
    );
  }

  async listarConfiguraciones(): Promise<unknown[]> {
    const respuesta = await firstValueFrom(
      this.http.get<{ configuraciones: unknown[] }>(`${this.base}/configuracion-categorias`),
    );
    return respuesta.configuraciones;
  }

  async obtenerResumen(anio: number): Promise<ResumenTributarioApi> {
    return firstValueFrom(
      this.http.get<ResumenTributarioApi>(`${this.base}/resumen-tributario/${anio}`),
    );
  }

  /** El backend aplica las tablas del SRI (progresiva, RIMPE, sociedades) vigentes para el año consultado. */
  async calcularImpuestoRenta(anio: number, dto: CalcularImpuestoRentaApi): Promise<any> {
    return firstValueFrom(
      this.http.post(`${this.base}/impuesto-renta/${anio}/calcular`, dto),
    );
  }

  /** Prellenado del Formulario 104 (IVA) de un mes con datos ya registrados en Fintech (facturas, comprobantes y retenciones). */
  async obtenerPrellenadoFormulario104(anio: number, mes: number): Promise<PrellenadoFormulario104Api> {
    return firstValueFrom(
      this.http.get<PrellenadoFormulario104Api>(`${this.base}/formulario-104/${anio}/${mes}/prellenado`),
    );
  }

  /** Genera el PDF real del borrador SRI (104/103/102) en el backend y dispara la descarga en el navegador. */
  async descargarBorradorPdf(dto: GenerarBorradorSriApi): Promise<void> {
    const blob = await firstValueFrom(
      this.http.post(`${this.base}/borradores-sri/exportar`, dto, { responseType: 'blob' }),
    );

    const nombreArchivo = [
      'borrador-sri',
      dto.tipoFormulario.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase(),
      dto.numeroAdhesion,
    ].join('-') + '.pdf';

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
