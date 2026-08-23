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

export interface Goal {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string;
  category: string;
  icon: string;
  color: string;
  monthlyDeposit: number;
}

@Component({
  selector: 'app-metas-ahorro',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './metas-ahorro.html',
  styleUrl: './metas-ahorro.css',
})
export class MetasAhorro implements AfterViewInit, OnDestroy {
  @ViewChild('neuralCanvas') private canvasRef?: ElementRef<HTMLCanvasElement>;

  protected readonly userData = inject(UserDataService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private animationFrameId?: number;
  private resizeHandler?: () => void;

  readonly filter = signal<'todas' | 'en_curso' | 'completadas'>('todas');
  readonly showCreateModal = signal(false);
  readonly showDepositModal = signal(false);
  readonly selectedGoalId = signal<string | null>(null);
  readonly showTipWidget = signal(true);

  // Toast Notification
  readonly toastMessage = signal<string | null>(null);

  // Form Signals for New Goal
  readonly formName = signal('');
  readonly formTarget = signal<number | null>(null);
  readonly formInitial = signal<number | null>(null);
  readonly formDeadline = signal('');
  readonly formIcon = signal('🎯');
  readonly formColor = signal('#06b6d4');

  // Deposit Signal
  readonly depositAmount = signal<number | null>(null);

  readonly goals = computed<Goal[]>(() => {
    return this.userData.savingsGoals().map((g) => ({
      id: g.id,
      name: g.name,
      target: g.target,
      current: g.current,
      deadline: g.deadline || 'Sin fecha',
      category: g.category || 'Ahorro Personal',
      icon: g.icon || '🎯',
      color: g.color || '#06b6d4',
      monthlyDeposit: Math.round(Math.max(0, g.target - g.current) / 12),
    }));
  });

  // Computed metrics
  readonly totalSaved = computed(() => this.goals().reduce((acc, g) => acc + g.current, 0));
  readonly totalTarget = computed(() => this.goals().reduce((acc, g) => acc + g.target, 0));
  readonly globalPercent = computed(() => Math.round((this.totalSaved() / this.totalTarget()) * 100));
  readonly completedCount = computed(() => this.goals().filter((g) => g.current >= g.target).length);

  readonly filteredGoals = computed(() => {
    const f = this.filter();
    return this.goals().filter((g) => {
      if (f === 'en_curso') return g.current < g.target;
      if (f === 'completadas') return g.current >= g.target;
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

  setFilter(f: 'todas' | 'en_curso' | 'completadas') {
    this.filter.set(f);
  }

  openCreateModal() {
    this.formName.set('');
    this.formTarget.set(null);
    this.formInitial.set(null);
    this.formDeadline.set('');
    this.showCreateModal.set(true);
  }

  closeCreateModal() {
    this.showCreateModal.set(false);
  }

  readonly saving = signal(false);

  async saveGoal() {
    if (!this.formName().trim() || !this.formTarget() || this.formTarget()! <= 0) return;

    const initial = Number(this.formInitial()) || 0;
    const target = Number(this.formTarget());
    const deadline = this.formDeadline().trim() || proximoFinDeAnio();

    this.saving.set(true);
    try {
      await this.userData.addSavingGoal({
        name: this.formName().trim(),
        target,
        deadline,
        initial: Math.min(initial, target),
      });
      this.triggerToast('¡Meta creada exitosamente! 🚀');
      this.closeCreateModal();
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo crear la meta.'));
    } finally {
      this.saving.set(false);
    }
  }

  openDepositModal(goalId: string) {
    this.selectedGoalId.set(goalId);
    this.depositAmount.set(null);
    this.showDepositModal.set(true);
  }

  closeDepositModal() {
    this.showDepositModal.set(false);
    this.selectedGoalId.set(null);
  }

  async addDeposit() {
    const id = this.selectedGoalId();
    const amount = Number(this.depositAmount());
    if (!id || !amount || amount <= 0) return;

    try {
      await this.userData.addGoalDeposit(id, amount);
      this.triggerToast(`+$${amount} abonados a tu meta 🎉`);
      this.closeDepositModal();
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo registrar el abono.'));
    }
  }

  async deleteGoal(id: string) {
    try {
      await this.userData.deleteSavingGoal(id);
      this.triggerToast('Meta eliminada.');
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo eliminar la meta.'));
    }
  }

  getPercent(current: number, target: number): number {
    return Math.min(100, Math.round((current / target) * 100));
  }

  private triggerToast(msg: string) {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(null), 3500);
  }

  private initNeuralCanvas(): void {
    // Fondo estático y limpio
  }
}

/** 31 de diciembre del año actual, en formato YYYY-MM-DD, como fecha límite por defecto. */
function proximoFinDeAnio(): string {
  const anio = new Date().getFullYear();
  return `${anio}-12-31`;
}
