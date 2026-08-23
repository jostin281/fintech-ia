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
import { mensajeDeError } from '../../services/http-error';

export interface Budget {
  id: string;
  category: string;
  limit: number;
  spent: number;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-presupuestos',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './presupuestos.html',
  styleUrl: './presupuestos.css',
})
export class Presupuestos implements AfterViewInit, OnDestroy {
  @ViewChild('neuralCanvas') private canvasRef?: ElementRef<HTMLCanvasElement>;

  protected readonly userData = inject(UserDataService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private animationFrameId?: number;
  private resizeHandler?: () => void;

  readonly filter = signal<'todos' | 'rango' | 'alerta' | 'excedido'>('todos');
  readonly showModal = signal(false);
  readonly showExpenseModal = signal(false);
  readonly selectedBudgetId = signal<string | null>(null);
  readonly showTipWidget = signal(true);
  readonly toastMessage = signal<string | null>(null);

  // Form Signals for New Budget
  readonly formCategoriaId = signal<number | null>(null);
  readonly formLimit = signal<number | null>(null);
  readonly formIcon = signal('🛒');
  readonly formColor = signal('#06b6d4');
  readonly saving = signal(false);

  // Form Signals for Adding Expense
  readonly expenseAmount = signal<number | null>(null);
  readonly expenseConcept = signal('');

  /** Categorías de gasto que todavía no tienen presupuesto este mes. */
  readonly categoriasDisponibles = computed(() => {
    const usadas = new Set(this.userData.budgets().map((b) => b.categoriaId));
    return this.userData.categoriasGasto().filter((c) => !usadas.has(c.id));
  });

  readonly budgets = computed<Budget[]>(() => {
    return this.userData.budgets().map((b) => ({
      id: b.id,
      category: b.category,
      limit: b.limit,
      spent: b.spent,
      icon: b.icon || '🛒',
      color: b.color || '#06b6d4',
    }));
  });

  // Computed metrics
  readonly totalLimit = computed(() => this.budgets().reduce((acc, b) => acc + b.limit, 0));
  readonly totalSpent = computed(() => this.budgets().reduce((acc, b) => acc + b.spent, 0));
  readonly totalRemaining = computed(() => this.totalLimit() - this.totalSpent());
  readonly globalPercent = computed(() => Math.min(100, Math.round((this.totalSpent() / this.totalLimit()) * 100)));

  readonly filteredBudgets = computed(() => {
    const f = this.filter();
    return this.budgets().filter((b) => {
      const pct = (b.spent / b.limit) * 100;
      if (f === 'excedido') return pct > 100;
      if (f === 'alerta') return pct > 80 && pct <= 100;
      if (f === 'rango') return pct <= 80;
      return true;
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

  setFilter(f: 'todos' | 'rango' | 'alerta' | 'excedido') {
    this.filter.set(f);
  }

  openCreateModal() {
    this.formCategoriaId.set(this.categoriasDisponibles()[0]?.id ?? null);
    this.formLimit.set(null);
    this.showModal.set(true);
  }

  closeCreateModal() {
    this.showModal.set(false);
  }

  async saveBudget() {
    const categoriaId = this.formCategoriaId();
    if (!categoriaId || !this.formLimit() || this.formLimit()! <= 0) return;

    this.saving.set(true);
    try {
      await this.userData.addBudget({
        categoriaId,
        limit: Number(this.formLimit()),
      });
      this.closeCreateModal();
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo crear el presupuesto.'));
    } finally {
      this.saving.set(false);
    }
  }

  private triggerToast(msg: string) {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(null), 3500);
  }

  openExpenseModal(budgetId: string) {
    this.selectedBudgetId.set(budgetId);
    this.expenseAmount.set(null);
    this.expenseConcept.set('');
    this.showExpenseModal.set(true);
  }

  closeExpenseModal() {
    this.showExpenseModal.set(false);
    this.selectedBudgetId.set(null);
  }

  async addExpense() {
    const id = this.selectedBudgetId();
    const amount = Number(this.expenseAmount());
    if (!id || !amount || amount <= 0) return;

    const budgetItem = this.userData.budgets().find((b) => b.id === id);
    if (!budgetItem) return;

    this.saving.set(true);
    try {
      await this.userData.addTransaction({
        concept: this.expenseConcept().trim() || `Gasto en ${budgetItem.category}`,
        amount,
        type: 'egreso',
        categoriaId: budgetItem.categoriaId,
      });
      this.closeExpenseModal();
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo registrar el gasto.'));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteBudget(id: string) {
    try {
      await this.userData.deleteBudget(id);
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo eliminar el presupuesto.'));
    }
  }

  getPercent(spent: number, limit: number): number {
    return Math.round((spent / limit) * 100);
  }

  getStatusClass(spent: number, limit: number): string {
    const pct = (spent / limit) * 100;
    if (pct > 100) return 'excedido';
    if (pct > 80) return 'alerta';
    return 'rango';
  }

  getStatusLabel(spent: number, limit: number): string {
    const pct = (spent / limit) * 100;
    if (pct > 100) return 'Excedido';
    if (pct > 80) return 'En Alerta';
    return 'En Rango';
  }

  private initNeuralCanvas(): void {
    // Fondo estático y limpio
  }
}
