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
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { ReportesApiService, type ResultadoReporteApi, type TipoReporteApi } from '../../services/api/reportes.api';
import { mensajeDeError } from '../../services/http-error';

export interface CategoryBreakdown {
  name: string;
  amount: number;
  percentage: number;
  color: string;
  icon: string;
}

export interface CalendarDay {
  iso: string;
  numero: number;
  enMes: boolean;
  esHoy: boolean;
}

export interface CalendarMonth {
  indice: number;
  nombreCorto: string;
  esActual: boolean;
}

export interface CalendarYear {
  anio: number;
  esActual: boolean;
}

/** Nivel de detalle dentro del calendario: se puede navegar por días, meses o años. */
export type NivelCalendario = 'dias' | 'meses' | 'anios';

const PALETA = ['#06b6d4', '#a855f7', '#f87171', '#10b981', '#fbbf24', '#f472b6', '#818cf8'];

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const NOMBRES_MESES_CORTOS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

// Tamaño del bloque mostrado en el nivel "años" del calendario.
const TAMANIO_BLOQUE_ANIOS = 12;

@Component({
  selector: 'app-reportes',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './reportes.html',
  styleUrl: './reportes.css',
})
export class Reportes implements AfterViewInit, OnDestroy {
  @ViewChild('neuralCanvas') private canvasRef?: ElementRef<HTMLCanvasElement>;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly reportesApi = inject(ReportesApiService);

  private animationFrameId?: number;
  private resizeHandler?: () => void;

  readonly period = signal<TipoReporteApi>('mensual');
  readonly toastMessage = signal<string | null>(null);
  readonly showTipWidget = signal(true);
  readonly cargando = signal(false);
  readonly exportando = signal(false);

  // ── Calendario: mini popover anclado al botón, sin salir de la pantalla de Reportes ──
  readonly calendarAbierto = signal(false);
  readonly calendarioFecha = signal<Date>(new Date());
  readonly fechaSeleccionada = signal<string | null>(null);

  /** Nivel de detalle actual: 'dias' (por defecto), 'meses' o 'anios'. Se cambia tocando el título. */
  readonly calendarView = signal<NivelCalendario>('dias');

  readonly calendarLabel = computed(() => {
    const fecha = this.calendarioFecha();
    const nivel = this.calendarView();

    if (nivel === 'meses') return `${fecha.getFullYear()}`;

    if (nivel === 'anios') {
      const inicio = this.inicioBloqueAnios(fecha.getFullYear());
      return `${inicio} – ${inicio + TAMANIO_BLOQUE_ANIOS - 1}`;
    }

    return `${NOMBRES_MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
  });

  readonly calendarMonths = computed<CalendarMonth[]>(() => {
    const anioActivo = this.calendarioFecha().getFullYear();
    const hoy = new Date();
    return NOMBRES_MESES_CORTOS.map((nombreCorto, indice) => ({
      indice,
      nombreCorto,
      esActual: anioActivo === hoy.getFullYear() && indice === hoy.getMonth(),
    }));
  });

  readonly calendarYears = computed<CalendarYear[]>(() => {
    const inicio = this.inicioBloqueAnios(this.calendarioFecha().getFullYear());
    const anioActual = new Date().getFullYear();
    return Array.from({ length: TAMANIO_BLOQUE_ANIOS }, (_, i) => ({
      anio: inicio + i,
      esActual: inicio + i === anioActual,
    }));
  });

  readonly calendarDays = computed<CalendarDay[]>(() => {
    const base = this.calendarioFecha();
    const anio = base.getFullYear();
    const mes = base.getMonth();

    const primerDiaMes = new Date(anio, mes, 1);
    // getDay(): domingo = 0 ... sábado = 6. Convertimos a semana que inicia en lunes.
    const offset = (primerDiaMes.getDay() + 6) % 7;
    const inicioGrid = new Date(anio, mes, 1 - offset);

    const hoyIso = this.formatearIso(new Date());

    const dias: CalendarDay[] = [];
    for (let i = 0; i < 42; i += 1) {
      const fecha = new Date(inicioGrid);
      fecha.setDate(inicioGrid.getDate() + i);
      const iso = this.formatearIso(fecha);
      dias.push({
        iso,
        numero: fecha.getDate(),
        enMes: fecha.getMonth() === mes,
        esHoy: iso === hoyIso,
      });
    }
    return dias;
  });

  readonly fechaSeleccionadaLegible = computed(() => {
    const iso = this.fechaSeleccionada();
    if (!iso) return '';
    const [anio, mes, dia] = iso.split('-').map(Number);
    const fecha = new Date(anio, mes - 1, dia);
    const texto = fecha.toLocaleDateString('es-EC', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  });

  readonly fechaSeleccionadaCorta = computed(() => {
    const iso = this.fechaSeleccionada();
    if (!iso) return '';
    const [anio, mes, dia] = iso.split('-').map(Number);
    const fecha = new Date(anio, mes - 1, dia);
    return fecha.toLocaleDateString('es-EC', { day: 'numeric', month: 'short' });
  });

  readonly periodoActualLabel = computed(() => {
    if (this.period() === 'diario' && this.fechaSeleccionada()) {
      return this.fechaSeleccionadaLegible();
    }
    const etiquetas: Record<TipoReporteApi, string> = {
      diario: 'Hoy',
      semanal: 'Esta Semana',
      mensual: 'Este Mes',
      anual: 'Este Año',
    };
    return etiquetas[this.period()];
  });

  private readonly reporte = signal<ResultadoReporteApi | null>(null);

  readonly totalIncome = computed(() => Number(this.reporte()?.resumen.ingresos ?? 0));
  readonly totalExpenses = computed(() => Number(this.reporte()?.resumen.gastos ?? 0));
  readonly netSavings = computed(() => Number(this.reporte()?.resumen.balance ?? 0));

  readonly categories = computed<CategoryBreakdown[]>(() => {
    const gastos = this.reporte()?.categorias.gastos ?? [];
    return gastos.map((cat, i) => ({
      name: cat.nombre,
      amount: Number(cat.monto),
      percentage: cat.porcentaje,
      color: PALETA[i % PALETA.length],
      icon: '📦',
    }));
  });

  readonly monthlyTrends = computed(() => {
    const evolucion = this.reporte()?.evolucion ?? [];
    return evolucion.map((punto) => ({
      month: punto.etiqueta,
      income: Number(punto.ingresos),
      expense: Number(punto.gastos),
    }));
  });

  readonly maxBarValue = computed(() =>
    Math.max(1, ...this.monthlyTrends().flatMap((t) => [t.income, t.expense])),
  );

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      this.initNeuralCanvas();
      void this.cargarReporte();
    }
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== undefined) cancelAnimationFrame(this.animationFrameId);
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
  }

  setPeriod(p: TipoReporteApi) {
    this.calendarAbierto.set(false);
    this.fechaSeleccionada.set(null);
    this.period.set(p);
    void this.cargarReporte();
  }

  /** Abre/cierra el mini calendario flotante, sin salir de la pantalla de Reportes. */
  toggleCalendario(): void {
    const abrira = !this.calendarAbierto();
    this.calendarAbierto.set(abrira);
    if (abrira) {
      this.calendarView.set('dias');
      const iso = this.fechaSeleccionada();
      if (iso) {
        const [anio, mes] = iso.split('-').map(Number);
        this.calendarioFecha.set(new Date(anio, mes - 1, 1));
      }
    }
  }

  cerrarCalendario(): void {
    this.calendarAbierto.set(false);
  }

  /** Toca el título para "alejar el zoom": días → meses → años. */
  subirNivelCalendario(): void {
    if (this.calendarView() === 'dias') this.calendarView.set('meses');
    else if (this.calendarView() === 'meses') this.calendarView.set('anios');
  }

  /** Flecha ↑: retrocede (mes, año o bloque de años, según el nivel activo). */
  navAnterior(): void {
    const nivel = this.calendarView();
    if (nivel === 'dias') this.calendarioFecha.update((f) => new Date(f.getFullYear(), f.getMonth() - 1, 1));
    else if (nivel === 'meses') this.calendarioFecha.update((f) => new Date(f.getFullYear() - 1, f.getMonth(), 1));
    else this.calendarioFecha.update((f) => new Date(f.getFullYear() - TAMANIO_BLOQUE_ANIOS, f.getMonth(), 1));
  }

  /** Flecha ↓: avanza (mes, año o bloque de años, según el nivel activo). */
  navSiguiente(): void {
    const nivel = this.calendarView();
    if (nivel === 'dias') this.calendarioFecha.update((f) => new Date(f.getFullYear(), f.getMonth() + 1, 1));
    else if (nivel === 'meses') this.calendarioFecha.update((f) => new Date(f.getFullYear() + 1, f.getMonth(), 1));
    else this.calendarioFecha.update((f) => new Date(f.getFullYear() + TAMANIO_BLOQUE_ANIOS, f.getMonth(), 1));
  }

  /** Elige un año dentro del nivel "años" y baja al nivel "meses". */
  seleccionarAnio(anio: CalendarYear): void {
    this.calendarioFecha.update((f) => new Date(anio.anio, f.getMonth(), 1));
    this.calendarView.set('meses');
  }

  /** Elige un mes dentro del nivel "meses" y baja al nivel "días". */
  seleccionarMes(mes: CalendarMonth): void {
    this.calendarioFecha.update((f) => new Date(f.getFullYear(), mes.indice, 1));
    this.calendarView.set('dias');
  }

  irAHoy(): void {
    const hoy = new Date();
    this.calendarioFecha.set(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    this.calendarView.set('dias');
    this.seleccionarFecha(this.formatearIso(hoy));
  }

  /** Quita el filtro por día y vuelve al reporte mensual estándar. */
  quitarSeleccion(): void {
    this.fechaSeleccionada.set(null);
    this.period.set('mensual');
    void this.cargarReporte();
  }

  seleccionarDia(dia: CalendarDay): void {
    if (!dia.enMes) {
      // Salta automáticamente al mes correspondiente si se aplasta un día "fuera de mes".
      const [anio, mes] = dia.iso.split('-').map(Number);
      this.calendarioFecha.set(new Date(anio, mes - 1, 1));
    }
    this.seleccionarFecha(dia.iso);
  }

  private seleccionarFecha(iso: string): void {
    this.fechaSeleccionada.set(iso);
    this.period.set('diario');
    this.calendarAbierto.set(false);
    void this.cargarReporte();
  }

  private inicioBloqueAnios(anio: number): number {
    return Math.floor(anio / TAMANIO_BLOQUE_ANIOS) * TAMANIO_BLOQUE_ANIOS;
  }

  private fechaReferenciaActual(): string | undefined {
    return this.period() === 'diario' ? (this.fechaSeleccionada() ?? undefined) : undefined;
  }

  private async cargarReporte(): Promise<void> {
    this.cargando.set(true);
    try {
      this.reporte.set(await this.reportesApi.obtener(this.period(), this.fechaReferenciaActual()));
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo cargar el reporte.'));
    } finally {
      this.cargando.set(false);
    }
  }

  /** Descarga el Excel real generado por el backend (exceljs), no un CSV simulado. */
  async downloadExcel() {
    this.exportando.set(true);
    try {
      await this.reportesApi.exportarYDescargar(this.period(), 'excel', this.fechaReferenciaActual());
      this.triggerToast('¡Archivo Excel descargado exitosamente! 📊📥');
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo exportar el Excel.'));
    } finally {
      this.exportando.set(false);
    }
  }

  /** Descarga el PDF real generado por el backend (pdfkit), no una vista de impresión simulada. */
  async downloadPDF() {
    this.exportando.set(true);
    try {
      await this.reportesApi.exportarYDescargar(this.period(), 'pdf', this.fechaReferenciaActual());
      this.triggerToast('¡Archivo PDF descargado exitosamente! 📄📥');
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo exportar el PDF.'));
    } finally {
      this.exportando.set(false);
    }
  }

  private triggerToast(msg: string) {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(null), 3500);
  }

  private formatearIso(fecha: Date): string {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  private initNeuralCanvas(): void {
    // Fondo estático y limpio
  }
}
