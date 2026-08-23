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
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth';

interface Transaction {
  id: string;
  concept: string;
  date: string;
  amount: number;
  type: 'ingreso' | 'egreso';
  category: string;
  icon: string;
  status: 'Completado' | 'Procesando';
}

interface SavingGoal {
  name: string;
  target: number;
  current: number;
  color: string;
  icon: string;
}

import { UserDataService } from '../../services/user-data';
import { BankingService } from '../../services/banking';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, RouterLinkActive, DecimalPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements AfterViewInit, OnDestroy {
  @ViewChild('neuralCanvas') private canvasRef?: ElementRef<HTMLCanvasElement>;

  protected readonly auth = inject(AuthService);
  protected readonly userData = inject(UserDataService);
  private readonly banking = inject(BankingService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private animationFrameId?: number;
  private resizeHandler?: () => void;

  readonly user = this.auth.currentUser;
  readonly userInitials = this.userData.userInitials;

  readonly showTipWidget = signal(true);

  // Currency selection
  readonly selectedCurrency = signal<'MXN' | 'USD' | 'EUR'>('USD');

  // Balances dinámicos por usuario
  readonly totalBalance = this.userData.totalBalance;
  readonly monthlyIncome = this.userData.monthlyIncome;
  readonly monthlyExpenses = this.userData.monthlyExpenses;
  readonly savingsRate = this.userData.savingsRate;

  // Filter for transactions
  readonly txFilter = signal<'todos' | 'ingreso' | 'egreso'>('todos');

  readonly recentTransactions = this.userData.transactions;
  readonly savingsGoals = this.userData.savingsGoals;

  /* ── Modal de Alerta al Iniciar Sesión ── */
  readonly showLoginAlertModal = signal(false);

  readonly exceededBudgets = computed(() =>
    this.userData.budgets().filter((b) => b.spent > b.limit)
  );

  readonly criticalNotifications = computed(() =>
    this.userData.notifications().filter(
      (n) => !n.read && (n.type === 'critica' || n.type === 'alerta')
    )
  );

  readonly hasRedAlerts = computed(
    () => this.exceededBudgets().length > 0 || this.criticalNotifications().length > 0
  );

  constructor() {
    effect(() => {
      if (this.isBrowser && !this.userData.cargando() && this.user()) {
        const alreadySeen = sessionStorage.getItem('fintech_seen_login_alert');
        if (!alreadySeen) {
          this.showLoginAlertModal.set(true);
        }
      }
    });
  }

  closeLoginAlertModal(): void {
    if (this.isBrowser) {
      sessionStorage.setItem('fintech_seen_login_alert', 'true');
    }
    this.showLoginAlertModal.set(false);
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

  setCurrency(curr: 'MXN' | 'USD' | 'EUR') {
    this.selectedCurrency.set(curr);
  }

  setTxFilter(f: 'todos' | 'ingreso' | 'egreso') {
    this.txFilter.set(f);
  }

  get filteredTransactions() {
    const filter = this.txFilter();
    if (filter === 'todos') return this.recentTransactions();
    return this.recentTransactions().filter(t => t.type === filter);
  }

  // Modales de Acciones Rápidas (Ecuador 🇪🇨)
  readonly showTransferModal = signal(false);
  readonly showBillModal = signal(false);
  readonly showPayServiceModal = signal(false);
  readonly showGoalModal = signal(false);
  readonly toastMessage = signal<string | null>(null);
  // Se activa mientras BankingService "llama" a cada acción (hoy: mock local con
  // latencia simulada; el día que exista backend, este mismo flag refleja la
  // llamada HTTP real sin tener que tocar nada más en esta pantalla).
  readonly isSubmittingAction = signal(false);

  // Form Transferir Ecuador 🇪🇨
  readonly transferBank = signal('Banco Pichincha');
  readonly transferAccountType = signal('Cuenta Ahorros');
  readonly transferIdNum = signal('');
  readonly transferRecipient = signal('');
  readonly transferAmount = signal<number | null>(null);

  // Form Facturar SRI Ecuador 🇪🇨
  readonly billDocType = signal<'01' | '07' | '04'>('01');
  readonly billClientType = signal<'RUC' | 'Cédula' | 'Consumidor Final'>('RUC');
  readonly billClient = signal('');
  readonly billRuc = signal('1790016919001');
  readonly billAmount = signal<number | null>(null);

  // Form Pagar Servicio Ecuador 🇪🇨
  readonly payEcuadorService = signal('⚡ EEQ - Empresa Eléctrica Quito');
  readonly payContractRef = signal('');
  readonly payAmount = signal<number | null>(null);

  // Form Nueva Meta Ecuador 🇪🇨
  readonly goalCategoryEcuador = signal('🏠 Entrada Vivienda (Biess/Banco)');
  readonly goalName = signal('');
  readonly goalTarget = signal<number | null>(null);
  readonly goalInitial = signal<number | null>(null);

  // Pre-seleccionadores Ecuador
  selectEcuadorClient(preset: { name: string; ruc: string }) {
    this.billClient.set(preset.name);
    this.billRuc.set(preset.ruc);
  }

  // Resúmenes en vivo: para que siempre se vea "a dónde va" cada acción antes de confirmar.
  readonly transferSummary = computed(() => {
    const amount = this.transferAmount();
    if (!amount || amount <= 0) return null;
    const recipient = this.transferRecipient().trim() || 'un beneficiario';
    return `Vas a transferir $${amount.toLocaleString()} USD a ${recipient} · ${this.transferBank()} (${this.transferAccountType()})`;
  });

  readonly billSummary = computed(() => {
    const amount = this.billAmount();
    if (!amount || amount <= 0) return null;
    const client = this.billClient().trim() || 'Consumidor Final';
    const ruc = this.billRuc().trim() || '9999999999999';
    return `Vas a facturar $${amount.toLocaleString()} USD a ${client} · RUC ${ruc}`;
  });

  readonly paySummary = computed(() => {
    const amount = this.payAmount();
    if (!amount || amount <= 0) return null;
    const ref = this.payContractRef().trim();
    return `Vas a pagar $${amount.toLocaleString()} USD a ${this.payEcuadorService()}${ref ? ' · Ref ' + ref : ''}`;
  });

  readonly goalSummary = computed(() => {
    const target = this.goalTarget();
    if (!target || target <= 0) return null;
    const name = this.goalName().trim();
    const finalName = name ? `${this.goalCategoryEcuador()} - ${name}` : this.goalCategoryEcuador();
    const initial = Number(this.goalInitial()) || 0;
    return `Vas a crear la meta "${finalName}" por $${target.toLocaleString()} USD${initial > 0 ? ` (abono inicial $${initial.toLocaleString()})` : ''}`;
  });

  // Acciones Rápidas
  openTransferModal() {
    this.transferRecipient.set('');
    this.transferIdNum.set('');
    this.transferAmount.set(null);
    this.showTransferModal.set(true);
  }

  async executeTransfer() {
    const amount = Number(this.transferAmount());
    if (!amount || amount <= 0 || this.isSubmittingAction()) return;

    this.isSubmittingAction.set(true);
    const result = await this.banking.transfer({
      bank: this.transferBank(),
      accountType: this.transferAccountType(),
      recipientIdNumber: this.transferIdNum().trim(),
      recipientName: this.transferRecipient().trim() || 'Beneficiario Ecuador',
      amountUsd: amount,
    });
    this.isSubmittingAction.set(false);

    this.triggerToast(result.message);
    if (result.success) this.showTransferModal.set(false);
  }

  openBillModal() {
    this.billClient.set('');
    this.billRuc.set('1790016919001');
    this.billAmount.set(null);
    this.showBillModal.set(true);
  }

  async executeBilling() {
    const amount = Number(this.billAmount());
    if (!amount || amount <= 0 || this.isSubmittingAction()) return;

    this.isSubmittingAction.set(true);
    const result = await this.banking.issueInvoice({
      clientName: this.billClient().trim(),
      clientRuc: this.billRuc().trim(),
      amountUsd: amount,
    });
    this.isSubmittingAction.set(false);

    this.triggerToast(result.message);
    if (result.success) this.showBillModal.set(false);
  }

  openPayServiceModal() {
    this.payContractRef.set('');
    this.payAmount.set(null);
    this.showPayServiceModal.set(true);
  }

  async executePayService() {
    const amount = Number(this.payAmount());
    if (!amount || amount <= 0 || this.isSubmittingAction()) return;

    this.isSubmittingAction.set(true);
    const result = await this.banking.payService({
      entity: this.payEcuadorService(),
      contractRef: this.payContractRef().trim(),
      amountUsd: amount,
    });
    this.isSubmittingAction.set(false);

    this.triggerToast(result.message);
    if (result.success) this.showPayServiceModal.set(false);
  }

  openGoalModal() {
    this.goalName.set('');
    this.goalTarget.set(null);
    this.goalInitial.set(null);
    this.showGoalModal.set(true);
  }

  async executeCreateGoal() {
    const target = Number(this.goalTarget());
    if (!target || target <= 0 || this.isSubmittingAction()) return;

    this.isSubmittingAction.set(true);
    const result = await this.banking.createGoal({
      category: this.goalCategoryEcuador(),
      customName: this.goalName().trim(),
      targetUsd: target,
      initialUsd: Number(this.goalInitial()) || 0,
    });
    this.isSubmittingAction.set(false);

    this.triggerToast(result.message);
    if (result.success) this.showGoalModal.set(false);
  }

  private triggerToast(msg: string) {
    this.toastMessage.set(msg);
    setTimeout(() => {
      if (this.toastMessage() === msg) this.toastMessage.set(null);
    }, 3500);
  }

  logout(): void {
    if (this.isBrowser) {
      sessionStorage.removeItem('fintech_seen_login_alert');
    }
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  /* ── Fondo estático sin animación ── */
  private initNeuralCanvas(): void {
    // Fondo estático y limpio desactivado para evitar distracciones visuales
  }
}
