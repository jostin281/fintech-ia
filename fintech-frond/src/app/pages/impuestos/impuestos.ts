import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser, DecimalPipe, JsonPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  ResumenTributarioApiService,
  type LineaBorradorSriApi,
} from '../../services/api/facturacion.api';
import { mensajeDeError } from '../../services/http-error';
import { AuthService } from '../../services/auth';
import { RdepListado } from './rdep/rdep-listado';
import { RdepFormulario } from './rdep/rdep-formulario';

/**
 * Esta pantalla trabaja con los 2 formularios legales del SRI Ecuador: el
 * 104 (IVA) y el 107 / Anexo RDEP (Retenciones en la Fuente del Impuesto a
 * la Renta por Ingresos del Trabajo en Relación de Dependencia).
 *
 * - El Formulario 104 sigue siendo una calculadora rápida en memoria: sus
 *   casilleros se tomaron de la "Guía para el llenado del Formulario IVA"
 *   (sri.gob.ec) y genera un PDF de referencia con generarBorrador104().
 * - El Formulario 107 / RDEP es ahora un módulo persistido en base de datos
 *   (ver ./rdep/rdep-listado.* y ./rdep/rdep-formulario.*), con historial,
 *   validaciones oficiales del SRI y generación del PDF de consulta + el
 *   anexo Excel oficial. Ya no usa la calculadora en memoria ni el helper
 *   genarBorrador() de abajo (ese helper quedó exclusivo del 104).
 *
 * El SRI actualiza sus formularios periódicamente: antes de presentar una
 * declaración real, verifica el casillero vigente en la versión actual del
 * formulario en sri.gob.ec. Estos borradores son solo de referencia (ver
 * aviso en el propio PDF generado).
 */

/** Formulario legal del SRI que genera el borrador PDF compartido (solo el 104 lo usa). */
export type TipoFormularioBorrador = 'Formulario 104 (IVA)';

@Component({
  selector: 'app-impuestos',
  imports: [RouterLink, DecimalPipe, FormsModule, JsonPipe, RdepListado, RdepFormulario],
  templateUrl: './impuestos.html',
  styleUrl: './impuestos.css',
})
export class Impuestos implements AfterViewInit, OnDestroy {
  @ViewChild('neuralCanvas') private canvasRef?: ElementRef<HTMLCanvasElement>;

  private readonly resumenApi = inject(ResumenTributarioApiService);
  private readonly auth = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private animationFrameId?: number;
  private resizeHandler?: () => void;

  readonly toastMessage = signal<string | null>(null);

  /** true mientras se genera y descarga el PDF real del borrador SRI (deshabilita los botones). */
  readonly exportandoBorrador = signal(false);

  // Estado general & navegación por tabs: solo quedan 2 formularios.
  readonly selectedTab = signal<'104' | '107'>('104');

  setTab(tab: '104' | '107') {
    this.selectedTab.set(tab);
  }

  // ── FORMULARIO 107 / ANEXO RDEP — navegación entre lista y formulario ──
  // (el módulo persistido vive en ./rdep/rdep-listado.* y ./rdep/rdep-formulario.*)
  readonly vistaRdep = signal<'lista' | 'formulario'>('lista');
  readonly rdepEditandoId = signal<number | null>(null);

  abrirNuevoRdep(): void {
    this.rdepEditandoId.set(null);
    this.vistaRdep.set('formulario');
  }

  abrirEditarRdep(id: number): void {
    this.rdepEditandoId.set(id);
    this.vistaRdep.set('formulario');
  }

  onRdepGuardado(): void {
    this.vistaRdep.set('lista');
  }

  volverListadoRdep(): void {
    this.vistaRdep.set('lista');
  }

  // ── RUC / CÉDULA DEL USUARIO & NOVENO DÍGITO (identificación en ambos formularios) ──
  readonly userRuc = signal('1792004123001');
  readonly novenoDigito = computed(() => {
    const ruc = this.userRuc().trim();
    if (ruc.length >= 9 && !isNaN(Number(ruc[8]))) {
      return Number(ruc[8]);
    }
    return 3; // Ejemplo por defecto
  });

  /** Fecha límite mensual/anual según el noveno dígito del RUC (tabla SRI). */
  readonly diaVencimientoSri = computed(() => {
    const d = this.novenoDigito();
    const map: Record<number, number> = {
      1: 10, 2: 12, 3: 14, 4: 16, 5: 18, 6: 20, 7: 22, 8: 24, 9: 26, 0: 28,
    };
    return map[d] ?? 14;
  });

  // ══════════════════════════════════════════════════════════════════════
  // FORMULARIO 104 — DECLARACIÓN DEL IMPUESTO AL VALOR AGREGADO (IVA)
  // ══════════════════════════════════════════════════════════════════════

  /** protected (no private): el selector de mes en el template lo recorre con @for. */
  protected readonly nombresMeses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  /** Mes/año del período que se está declarando — por defecto el actual, pero el usuario puede elegir otro. */
  readonly ivaAnioSeleccionado = signal(new Date().getFullYear());
  readonly ivaMesSeleccionado = signal(new Date().getMonth() + 1);

  /** true mientras se autocompletan los casilleros del 104 desde los datos ya registrados en Fintech. */
  readonly autocompletandoIva = signal(false);

  /**
   * Trae de tus facturas electrónicas, comprobantes de compra y retenciones
   * ya registrados en Fintech los montos del período seleccionado, y
   * rellena los casilleros 401/403/500/609 automáticamente. El usuario
   * sigue pudiendo corregir cualquier valor a mano después.
   */
  async autocompletarFormulario104(): Promise<void> {
    this.autocompletandoIva.set(true);
    try {
      const anio = this.ivaAnioSeleccionado();
      const mes = this.ivaMesSeleccionado();
      const prellenado = await this.resumenApi.obtenerPrellenadoFormulario104(anio, mes);

      this.ivaVentas15.set(Number(prellenado.ventasGravadas15));
      this.ivaVentas0.set(Number(prellenado.ventasGravadas0));
      this.ivaCompras15.set(Number(prellenado.comprasGravadas15));
      this.ivaRetencionesRecibidas.set(Number(prellenado.retencionesIvaRecibidas));

      const { facturasEmitidasConsideradas, comprobantesRecibidosConsiderados, retencionesConsideradas } =
        prellenado.fuentes;
      this.triggerToast(
        `✨ Formulario 104 autocompletado con ${this.nombresMeses[mes - 1]} ${anio}: ` +
          `${facturasEmitidasConsideradas} factura(s) emitida(s), ${comprobantesRecibidosConsiderados} compra(s) gravada(s), ` +
          `${retencionesConsideradas} retención(es) de IVA. Revisa los montos antes de generar el borrador.`,
      );
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo autocompletar el Formulario 104.'));
    } finally {
      this.autocompletandoIva.set(false);
    }
  }

  /** Casillero 401 — Ventas locales gravadas con tarifa diferente de cero. */
  readonly ivaVentas15 = signal<number>(2500);
  /** Casillero 403 — Ventas locales gravadas con tarifa 0%. */
  readonly ivaVentas0 = signal<number>(400);
  /** Casillero 500 — Adquisiciones y pagos gravados tarifa diferente de cero (con derecho a crédito tributario). */
  readonly ivaCompras15 = signal<number>(1200);
  /** Casillero 609 — Retenciones en la fuente de IVA que le han sido efectuadas en este período. */
  readonly ivaRetencionesRecibidas = signal<number>(45);

  /** Casillero 429 — Impuesto generado en ventas (IVA débito). */
  readonly ivaDebitoGenerado = computed(() =>
    Math.round(this.ivaVentas15() * 0.15 * 100) / 100
  );

  /**
   * Casillero 563 — Factor de proporcionalidad del crédito tributario: si en
   * el mismo período vendes bienes/servicios con tarifa 0% y 15% a la vez,
   * el crédito tributario de las compras de uso común no se reconoce al
   * 100%, solo en la proporción que representan las ventas gravadas 15%
   * sobre el total de ventas. Sin ventas 0%, el factor es 100%.
   */
  readonly ivaFactorProporcionalidad = computed(() => {
    const gravadas15 = this.ivaVentas15();
    const totalVentas = gravadas15 + this.ivaVentas0();
    if (totalVentas <= 0) return 1;
    return gravadas15 / totalVentas;
  });

  /** IVA de compras al 15% sin prorratear todavía (monto bruto). */
  readonly ivaCreditoTributarioBruto = computed(() =>
    Math.round(this.ivaCompras15() * 0.15 * 100) / 100
  );

  /** Casillero 564 — Crédito tributario aplicable en este período (ya prorrateado). */
  readonly ivaCreditoPagado = computed(() =>
    Math.round(this.ivaCreditoTributarioBruto() * this.ivaFactorProporcionalidad() * 100) / 100
  );

  /**
   * Casillero 601 — Impuesto causado (499-564), ANTES de restar retenciones.
   * En el formulario oficial las retenciones (609) se descuentan más
   * adelante, en el cálculo del "Subtotal/Total a pagar" (620/902), no
   * dentro del propio casillero 601.
   */
  readonly ivaImpuestoCausado601 = computed(() => {
    const saldo = this.ivaDebitoGenerado() - this.ivaCreditoPagado();
    return saldo > 0 ? Math.round(saldo * 100) / 100 : 0;
  });

  /**
   * Casillero 602 — Crédito tributario aplicable en este período, en la
   * sección "Resumen impositivo" (cuando el crédito de compras supera al
   * impuesto generado en ventas). Distinto del 564, que es el crédito ya
   * prorrateado antes de compararlo con el impuesto generado.
   */
  readonly ivaCreditoAplicable602 = computed(() => {
    const saldo = this.ivaCreditoPagado() - this.ivaDebitoGenerado();
    return saldo > 0 ? Math.round(saldo * 100) / 100 : 0;
  });

  /**
   * Total a pagar (equivalente al casillero 902 del formulario oficial):
   * el impuesto causado (601) ya con las retenciones de IVA (609)
   * descontadas.
   */
  readonly ivaImpuestoNetoAPagar = computed(() => {
    const saldo = this.ivaImpuestoCausado601() - this.ivaRetencionesRecibidas();
    return saldo > 0 ? Math.round(saldo * 100) / 100 : 0;
  });

  /** Casillero 615 — Saldo de crédito tributario para el próximo mes (si el saldo del período es a favor). */
  readonly ivaCreditoTributarioAFavor = computed(() => {
    const saldo =
      (this.ivaCreditoAplicable602() + this.ivaRetencionesRecibidas()) - this.ivaImpuestoCausado601();
    return saldo > 0 ? Math.round(saldo * 100) / 100 : 0;
  });

  /** Filas del detalle del borrador para el Formulario 104 (IVA), con casilleros oficiales. */
  private construirLineas104(): LineaBorradorSriApi[] {
    const lineas: LineaBorradorSriApi[] = [
      { etiqueta: 'Casillero 401 · Ventas gravadas tarifa 15%', valor: `$${this.ivaVentas15().toFixed(2)} USD` },
      { etiqueta: 'Casillero 403 · Ventas gravadas tarifa 0%', valor: `$${this.ivaVentas0().toFixed(2)} USD` },
      { etiqueta: 'Casillero 429 · Impuesto generado en ventas', valor: `+$${this.ivaDebitoGenerado().toFixed(2)} USD` },
      { etiqueta: 'Casillero 500 · Adquisiciones gravadas 15% con derecho a crédito', valor: `$${this.ivaCompras15().toFixed(2)} USD` },
    ];

    if (this.ivaFactorProporcionalidad() < 1) {
      lineas.push({
        etiqueta: 'Casillero 563 · Factor de proporcionalidad aplicado',
        valor: `${(this.ivaFactorProporcionalidad() * 100).toFixed(1)}%`,
      });
    }

    lineas.push({ etiqueta: 'Casillero 564 · Crédito tributario aplicable', valor: `-$${this.ivaCreditoPagado().toFixed(2)} USD` });

    // Orden igual al formulario oficial: 601/602 (Resumen impositivo) se
    // calcula antes de descontar las retenciones (609), que se aplican
    // después, al obtener el total a pagar (902) o el crédito a favor (615).
    const causado601 = this.ivaImpuestoCausado601();
    const credito602 = this.ivaCreditoAplicable602();
    if (causado601 > 0) {
      lineas.push({ etiqueta: 'Casillero 601 · Impuesto causado', valor: `$${causado601.toFixed(2)} USD` });
    } else if (credito602 > 0) {
      lineas.push({
        etiqueta: 'Casillero 602 · Crédito tributario que excede el impuesto generado',
        valor: `$${credito602.toFixed(2)} USD`,
      });
    }

    lineas.push({ etiqueta: 'Casillero 609 · Retenciones de IVA recibidas', valor: `-$${this.ivaRetencionesRecibidas().toFixed(2)} USD` });

    return lineas;
  }

  /** Genera y descarga el PDF real del borrador del Formulario 104. */
  async generarBorrador104(): Promise<void> {
    const monto = this.ivaImpuestoNetoAPagar();
    const esAPagar = monto > 0;
    const resultadoEtiqueta = esAPagar
      ? 'Total impuesto a pagar (equivalente al casillero 902)'
      : 'Casillero 615 · Saldo crédito tributario para el próximo mes';
    const resultadoValor = esAPagar
      ? `$${monto.toFixed(2)} USD (A PAGAR)`
      : `$${this.ivaCreditoTributarioAFavor().toFixed(2)} USD (A FAVOR / próximo mes)`;

    await this.generarBorrador(
      'Formulario 104 (IVA)',
      this.periodoActualLegible(),
      this.construirLineas104(),
      resultadoEtiqueta,
      resultadoValor,
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // FORMULARIO 107 — RETENCIONES EN LA FUENTE DEL IMPUESTO A LA RENTA POR
  // INGRESOS DEL TRABAJO EN RELACIÓN DE DEPENDENCIA
  //
  // Reemplazado por el módulo persistido (BD) de Formulario 107 / Anexo
  // RDEP: ver ./rdep/rdep-listado.* y ./rdep/rdep-formulario.*, expuesto en
  // esta pantalla a través de las señales vistaRdep/rdepEditandoId y sus
  // métodos de navegación (más arriba). Ya no existe una calculadora rápida
  // en memoria para el 107: todo se guarda en la base de datos, se valida
  // contra las reglas oficiales del SRI y se genera desde el backend.
  // ══════════════════════════════════════════════════════════════════════

  // ══════════════════════════════════════════════════════════════════════
  // GENERACIÓN DE PDF (Formulario 104)
  // ══════════════════════════════════════════════════════════════════════

  private async generarBorrador(
    tipoFormulario: TipoFormularioBorrador,
    periodo: string,
    lineas: LineaBorradorSriApi[],
    resultadoEtiqueta: string,
    resultadoValor: string,
  ): Promise<void> {
    const adhesion = `${this.userRuc()}${Math.floor(1000 + Math.random() * 9000)}`;

    this.exportandoBorrador.set(true);
    try {
      await this.resumenApi.descargarBorradorPdf({
        tipoFormulario,
        periodo,
        ruc: this.userRuc(),
        numeroAdhesion: adhesion,
        lineas,
        resultadoEtiqueta,
        resultadoValor,
        nombreContribuyente: this.auth.currentUser()?.name,
      });
      this.triggerToast(`✨ ¡Borrador del ${tipoFormulario} generado y descargado (Nº Adhesión ${adhesion})! 🇪🇨🧾`);
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo generar el borrador PDF.'));
    } finally {
      this.exportandoBorrador.set(false);
    }
  }

  /** "Agosto 2026", etc. — el período que el usuario eligió arriba para el Formulario 104 (por defecto, el actual). */
  private periodoActualLegible(): string {
    return `${this.nombresMeses[this.ivaMesSeleccionado() - 1]} ${this.ivaAnioSeleccionado()}`;
  }

  protected triggerToast(msg: string) {
    this.toastMessage.set(msg);
    setTimeout(() => {
      if (this.toastMessage() === msg) this.toastMessage.set(null);
    }, 3500);
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      this.initNeuralCanvas();
    }
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== undefined) cancelAnimationFrame(this.animationFrameId);
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
  }

  private initNeuralCanvas(): void {
    // Fondo estático y limpio desactivado para evitar distracciones visuales
  }
}
