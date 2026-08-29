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

import { UserDataService } from '../../services/user-data';
import { TipsService } from '../../services/tips';
import { mensajeDeError } from '../../services/http-error';

export interface Movement {
  id: string;
  concept: string;
  category: string;
  amount: number;
  type: 'ingreso' | 'egreso';
  date: string;
  method: string;
  status: 'Completado' | 'Pendiente' | 'Cancelado';
  icon: string;
}

@Component({
  selector: 'app-movimientos',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './movimientos.html',
  styleUrl: './movimientos.css',
})
export class Movimientos implements AfterViewInit, OnDestroy {
  @ViewChild('neuralCanvas') private canvasRef?: ElementRef<HTMLCanvasElement>;

  protected readonly userData = inject(UserDataService);
  protected readonly tips = inject(TipsService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private animationFrameId?: number;
  private resizeHandler?: () => void;

  readonly searchKeyword = signal('');
  readonly typeFilter = signal<'todos' | 'ingreso' | 'egreso'>('todos');
  readonly showModal = signal(false);
  readonly toastMessage = signal<string | null>(null);
  readonly showTipWidget = signal(true);

  // Form Signals for New Movement
  readonly formConcept = signal('');
  readonly formAmount = signal<number | null>(null);
  readonly formType = signal<'ingreso' | 'egreso'>('egreso');
  readonly formCategoriaId = signal<number | null>(null);
  readonly formMethod = signal('Tarjeta de Débito');
  readonly saving = signal(false);

  readonly categoriasDisponibles = computed(() =>
    this.formType() === 'ingreso' ? this.userData.categoriasIngreso() : this.userData.categoriasGasto(),
  );

  readonly movements = computed<Movement[]>(() => {
    return this.userData.transactions().map((t) => ({
      id: t.id,
      concept: t.concept,
      category: t.category,
      amount: Math.abs(t.amount),
      type: t.type,
      date: t.date,
      method: 'Tarjeta / SPEI',
      status: 'Completado',
      icon: t.icon || (t.type === 'ingreso' ? '💵' : '💸'),
    }));
  });

  // Computed metrics
  readonly totalIncome = computed(() =>
    this.movements()
      .filter((m) => m.type === 'ingreso')
      .reduce((acc, m) => acc + m.amount, 0)
  );

  readonly totalExpense = computed(() =>
    this.movements()
      .filter((m) => m.type === 'egreso')
      .reduce((acc, m) => acc + m.amount, 0)
  );

  readonly netFlow = computed(() => this.totalIncome() - this.totalExpense());

  readonly filteredMovements = computed(() => {
    const query = this.searchKeyword().toLowerCase().trim();
    const type = this.typeFilter();

    return this.movements().filter((m) => {
      const matchType = type === 'todos' || m.type === type;
      const matchSearch =
        !query ||
        m.concept.toLowerCase().includes(query) ||
        m.category.toLowerCase().includes(query) ||
        m.method.toLowerCase().includes(query);
      return matchType && matchSearch;
    });
  });

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      this.initNeuralCanvas();
    }
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== undefined) cancelAnimationFrame(this.animationFrameId);
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
  }

  updateSearch(e: Event) {
    this.searchKeyword.set((e.target as HTMLInputElement).value);
  }

  setTypeFilter(t: 'todos' | 'ingreso' | 'egreso') {
    this.typeFilter.set(t);
  }

  openCreateModal() {
    this.formConcept.set('');
    this.formAmount.set(null);
    this.formCategoriaId.set(this.categoriasDisponibles()[0]?.id ?? null);
    this.showModal.set(true);
  }

  closeCreateModal() {
    this.showModal.set(false);
  }

  setFormType(t: 'ingreso' | 'egreso') {
    this.formType.set(t);
    this.formCategoriaId.set(this.categoriasDisponibles()[0]?.id ?? null);
  }

  async saveMovement() {
    const categoriaId = this.formCategoriaId();
    if (!this.formConcept().trim() || !this.formAmount() || this.formAmount()! <= 0 || !categoriaId) return;

    this.saving.set(true);
    try {
      await this.userData.addTransaction({
        concept: this.formConcept().trim(),
        amount: Number(this.formAmount()),
        type: this.formType(),
        categoriaId,
      });
      this.triggerToast('Movimiento registrado correctamente ✨');
      this.closeCreateModal();
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo registrar el movimiento.'));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteMovement(id: string) {
    try {
      await this.userData.deleteTransaction(id);
      this.triggerToast('Movimiento eliminado.');
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo eliminar el movimiento.'));
    }
  }

  /** Exportación real: genera un CSV con los movimientos visibles (respeta filtro/búsqueda) y lo descarga. */
  exportData() {
    if (!this.isBrowser) return;

    const filas = this.filteredMovements();
    if (filas.length === 0) {
      this.triggerToast('No hay movimientos para exportar con el filtro actual.');
      return;
    }

    const escapar = (valor: string) => `"${valor.replace(/"/g, '""')}"`;
    const encabezado = ['Fecha', 'Concepto', 'Categoría', 'Tipo', 'Monto (USD)', 'Método', 'Estado'];
    const lineas = filas.map((m) => {
      const monto = m.type === 'ingreso' ? m.amount : -m.amount;
      return [
        escapar(m.date),
        escapar(m.concept),
        escapar(m.category),
        escapar(m.type === 'ingreso' ? 'Ingreso' : 'Egreso'),
        monto.toFixed(2),
        escapar(m.method),
        escapar(m.status),
      ].join(',');
    });
    const csv = '\ufeff' + [encabezado.join(','), ...lineas].join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const fecha = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `movimientos_${fecha}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    this.triggerToast(`Descargado movimientos_${fecha}.csv (${filas.length} registros) 📥`);
  }

  private triggerToast(msg: string) {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(null), 3500);
  }

  /* ── Canvas Neuronal Background (Bolitas Flotantes Neón Gran Visibilidad) ── */
  private initNeuralCanvas(): void {
    // Fondo estático y limpio
  }
}
