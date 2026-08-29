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
import { TipsService } from '../../services/tips';

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
  protected readonly tips = inject(TipsService);
  private readonly banking = inject(BankingService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private animationFrameId?: number;
  private resizeHandler?: () => void;

  readonly user = this.auth.currentUser;
  readonly userInitials = this.userData.userInitials;

  readonly showTipWidget = signal(true);

  // Balances dinámicos por usuario
  readonly totalBalance = this.userData.totalBalance;
  readonly monthlyIncome = this.userData.monthlyIncome;
  readonly monthlyExpenses = this.userData.monthlyExpenses;
  readonly savingsRate = this.userData.savingsRate;
  /** Variación real del flujo neto de este mes vs. el anterior; null si no hay mes anterior con qué comparar. */
  readonly balanceChangePercent = this.userData.balanceChangePercent;

  /**
   * Serie diaria (últimos 30 días) del balance acumulado dentro de esa
   * ventana, calculada a partir de los movimientos reales del usuario.
   * Se acumula desde 0 al inicio de la ventana (no desde el balance total)
   * para que la forma de la curva sea legible sin importar cuán grande o
   * negativo sea el balance histórico.
   */
  private readonly serieTendenciaBalance = computed<number[]>(() => {
    const dias = 30;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const inicio = new Date(hoy);
    inicio.setDate(inicio.getDate() - (dias - 1));

    const netoPorDia = new Array<number>(dias).fill(0);
    for (const t of this.userData.transactions()) {
      const fecha = new Date(t.fechaIso);
      if (Number.isNaN(fecha.getTime())) continue;
      fecha.setHours(0, 0, 0, 0);
      const indice = Math.round((fecha.getTime() - inicio.getTime()) / 86_400_000);
      if (indice < 0 || indice >= dias) continue;
      netoPorDia[indice] += t.amount;
    }

    const acumulado: number[] = [];
    let corrido = 0;
    for (const neto of netoPorDia) {
      corrido += neto;
      acumulado.push(corrido);
    }
    return acumulado;
  });

  /** Línea, relleno y punto final del gráfico de tendencia, ya en coordenadas del viewBox (300x60). */
  readonly balanceTrend = computed(() => {
    const ancho = 300;
    const alto = 60;
    const margenY = 5;
    const serie = this.serieTendenciaBalance();

    const minimo = Math.min(...serie);
    const maximo = Math.max(...serie);
    const rango = maximo - minimo;

    const puntos = serie.map((valor, indice) => {
      const x = serie.length > 1 ? (indice / (serie.length - 1)) * ancho : 0;
      const y =
        rango === 0
          ? alto / 2
          : alto - margenY - ((valor - minimo) / rango) * (alto - margenY * 2);
      return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
    });

    const linea = construirPathSuave(puntos);
    const ultimo = puntos[puntos.length - 1] ?? { x: ancho, y: alto / 2 };
    const primero = puntos[0] ?? { x: 0, y: alto / 2 };

    return {
      linea,
      area: `${linea} L${ultimo.x},${alto} L${primero.x},${alto} Z`,
      puntoFinal: ultimo,
    };
  });

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

  /**
   * El modal de alerta al iniciar sesión es para un vistazo rápido, no
   * para reemplazar las pantallas de Presupuestos/Notificaciones: si hay
   * muchas alertas, se corta la lista y se muestra "+N más" en vez de
   * volverse una lista gigante que hay que scrollear.
   */
  private static readonly MAX_ALERTAS_EN_MODAL = 3;

  readonly exceededBudgetsPreview = computed(() =>
    this.exceededBudgets().slice(0, Dashboard.MAX_ALERTAS_EN_MODAL)
  );
  readonly exceededBudgetsRestantes = computed(() =>
    Math.max(0, this.exceededBudgets().length - Dashboard.MAX_ALERTAS_EN_MODAL)
  );

  readonly criticalNotificationsPreview = computed(() =>
    this.criticalNotifications().slice(0, Dashboard.MAX_ALERTAS_EN_MODAL)
  );
  readonly criticalNotificationsRestantes = computed(() =>
    Math.max(0, this.criticalNotifications().length - Dashboard.MAX_ALERTAS_EN_MODAL)
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

  setTxFilter(f: 'todos' | 'ingreso' | 'egreso') {
    this.txFilter.set(f);
  }

  get filteredTransactions() {
    const filter = this.txFilter();
    if (filter === 'todos') return this.recentTransactions();
    return this.recentTransactions().filter(t => t.type === filter);
  }

  // Modal de Acciones Rápidas (Ecuador 🇪🇨) — solo queda Nueva Meta como modal local,
  // porque es la única acción rápida 100% real (POST /api/metas-ahorro). Transferir/
  // Facturar/Pagar se quitaron de aquí: no había forma honesta de ejecutarlas desde un
  // modal rápido (ver services/banking.ts), así que ahora son enlaces reales a las
  // pantallas donde sí se pueden completar de verdad (Movimientos / Facturación Electrónica).
  readonly showGoalModal = signal(false);
  readonly toastMessage = signal<string | null>(null);
  readonly isSubmittingAction = signal(false);

  // Form Nueva Meta Ecuador 🇪🇨
  readonly goalCategoryEcuador = signal('🏠 Entrada Vivienda (Biess/Banco)');
  readonly goalName = signal('');
  readonly goalTarget = signal<number | null>(null);
  readonly goalInitial = signal<number | null>(null);

  // Resumen en vivo: para que siempre se vea "a dónde va" la acción antes de confirmar.
  readonly goalSummary = computed(() => {
    const target = this.goalTarget();
    if (!target || target <= 0) return null;
    const name = this.goalName().trim();
    const finalName = name ? `${this.goalCategoryEcuador()} - ${name}` : this.goalCategoryEcuador();
    const initial = Number(this.goalInitial()) || 0;
    return `Vas a crear la meta "${finalName}" por $${target.toLocaleString()} USD${initial > 0 ? ` (abono inicial $${initial.toLocaleString()})` : ''}`;
  });

  // Acciones Rápidas
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

/**
 * Traza una curva suave que pasa por cada punto real (Q usa el punto real
 * como control y el punto medio con el siguiente como destino, y T repite
 * el control reflejado): mismo truco visual que tenía la curva fija
 * original, pero ahora dibujado a partir de datos reales.
 */
function construirPathSuave(puntos: { x: number; y: number }[]): string {
  if (puntos.length === 0) return '';
  if (puntos.length === 1) return `M${puntos[0].x},${puntos[0].y}`;

  let d = `M${puntos[0].x},${puntos[0].y}`;
  for (let i = 0; i < puntos.length - 1; i++) {
    const actual = puntos[i];
    const siguiente = puntos[i + 1];
    const puntoMedioX = (actual.x + siguiente.x) / 2;
    const puntoMedioY = (actual.y + siguiente.y) / 2;
    d += ` Q${actual.x},${actual.y} ${puntoMedioX},${puntoMedioY}`;
  }
  const ultimo = puntos[puntos.length - 1];
  d += ` T${ultimo.x},${ultimo.y}`;
  return d;
}
