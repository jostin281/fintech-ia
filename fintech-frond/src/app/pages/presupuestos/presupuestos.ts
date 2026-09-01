import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { UserDataService, estaEnMesRelativo } from '../../services/user-data';
import { TipsService } from '../../services/tips';
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
  protected readonly tips = inject(TipsService);
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
  readonly creandoTodosSinAsignar = signal(false);

  // Form Signals for Adding Expense
  readonly expenseAmount = signal<number | null>(null);
  readonly expenseConcept = signal('');

  // Form Signals for Editing a Budget's Limit
  readonly showEditModal = signal(false);
  readonly editBudgetId = signal<string | null>(null);
  readonly editBudgetCategoria = signal('');
  readonly editLimit = signal<number | null>(null);
  readonly savingEdit = signal(false);

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

  readonly gastosSinPresupuesto = computed(() => {
    const categoriasConPresupuesto = new Set(this.userData.budgets().map((b) => b.categoriaId));
    const porCategoria = new Map<number, { categoriaId: number; nombre: string; monto: number }>();

    for (const t of this.userData.transactions()) {
      if (t.type !== 'egreso') continue;
      if (!estaEnMesRelativo(t.fechaIso, 0)) continue;
      if (categoriasConPresupuesto.has(t.categoriaId)) continue;

      const monto = Math.abs(t.amount);
      const existente = porCategoria.get(t.categoriaId);
      if (existente) {
        existente.monto += monto;
      } else {
        porCategoria.set(t.categoriaId, { categoriaId: t.categoriaId, nombre: t.category, monto });
      }
    }

    return Array.from(porCategoria.values()).sort((a, b) => b.monto - a.monto);
  });

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

  constructor() {
    // Si el modal "Nuevo Presupuesto" se abre justo cuando la cuenta es
    // nueva (o recién se inició sesión) y los datos todavía no habían
    // terminado de cargar, formCategoriaId se pudo haber quedado en null
    // (ver openCreateModal). En cuanto categoriasDisponibles() por fin
    // trae datos reales, si sigue sin haber una categoría elegida, se
    // preselecciona la primera — así "Guardar Presupuesto" nunca falla
    // en silencio por falta de categoría seleccionada.
    effect(() => {
      const disponibles = this.categoriasDisponibles();
      if (this.showModal() && this.formCategoriaId() === null && disponibles.length > 0) {
        this.formCategoriaId.set(disponibles[0].id);
      }
    });
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

  async crearTodosLosPresupuestosSinAsignar() {
    const pendientes = this.gastosSinPresupuesto();
    if (pendientes.length === 0) return;

    this.creandoTodosSinAsignar.set(true);
    let creados = 0;
    let fallidos = 0;
    try {
      for (const gasto of pendientes) {
        try {
          await this.userData.addBudget({
            categoriaId: gasto.categoriaId,
            limit: Math.ceil(gasto.monto),
          });
          creados++;
        } catch {
          fallidos++;
        }
      }

      if (fallidos === 0) {
        this.triggerToast(`✅ Se crearon ${creados} presupuesto${creados === 1 ? '' : 's'} automáticamente.`);
      } else if (creados > 0) {
        this.triggerToast(`Se crearon ${creados}, pero ${fallidos} no se pudieron crear. Intenta de nuevo con esas.`);
      } else {
        this.triggerToast('No se pudo crear ningún presupuesto. Intenta de nuevo.');
      }
    } finally {
      this.creandoTodosSinAsignar.set(false);
    }
  }

  openEditModal(budget: Budget) {
    this.editBudgetId.set(budget.id);
    this.editBudgetCategoria.set(budget.category);
    this.editLimit.set(budget.limit);
    this.showEditModal.set(true);
  }

  closeEditModal() {
    if (this.savingEdit()) return;
    this.showEditModal.set(false);
    this.editBudgetId.set(null);
  }

  async guardarEdicionLimite() {
    const id = this.editBudgetId();
    const nuevoLimite = this.editLimit();
    if (!id || !nuevoLimite || nuevoLimite <= 0) {
      this.triggerToast('Ingresa un límite mayor que cero.');
      return;
    }

    this.savingEdit.set(true);
    try {
      await this.userData.updateBudgetLimit(id, nuevoLimite);
      this.triggerToast('✅ Límite actualizado correctamente.');
      this.showEditModal.set(false);
      this.editBudgetId.set(null);
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo actualizar el límite.'));
    } finally {
      this.savingEdit.set(false);
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
