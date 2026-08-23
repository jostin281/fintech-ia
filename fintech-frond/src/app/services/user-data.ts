import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { AuthService, AuthUser } from './auth';
import { CategoriasApiService, type CategoriaApi } from './api/categorias.api';
import { MovimientosApiService, type MovimientoApi } from './api/movimientos.api';
import { PresupuestosApiService, type PresupuestoApi } from './api/presupuestos.api';
import { MetasAhorroApiService, type MetaAhorroApi } from './api/metas-ahorro.api';
import { NotificacionesApiService, type NotificacionApi } from './api/notificaciones.api';

/* ── Formas usadas por las pantallas (se conservan para no reescribir cada página) ── */

export interface Transaction {
  id: string;
  concept: string;
  date: string;
  amount: number;
  type: 'ingreso' | 'egreso';
  category: string;
  categoriaId: number;
  icon: string;
  status: string;
}

export interface SavingGoal {
  id: string;
  name: string;
  target: number;
  current: number;
  color: string;
  icon: string;
  deadline?: string;
  category?: string;
}

export interface BudgetItem {
  id: string;
  category: string;
  categoriaId: number;
  spent: number;
  limit: number;
  color: string;
  icon: string;
}

export interface AppNotification {
  id: number;
  type: 'critica' | 'alerta' | 'info' | 'exito' | 'warning';
  title: string;
  body: string;
  time: string;
  read: boolean;
  category: 'sistema' | 'alerta' | 'info';
  actionUrl?: string;
  actionText?: string;
}

export interface UserProfileDetails {
  phone: string;
  company: string;
  address: string;
  occupation: string;
  bio: string;
}

/**
 * Fuente única de datos financieros del usuario autenticado, conectada al
 * backend real (NestJS) en vez de localStorage. Expone las mismas señales
 * que usaban las pantallas (transactions, savingsGoals, budgets,
 * notifications...) para no tener que reescribir cada página, pero ahora
 * cada método hace una petición HTTP real y refresca el estado con la
 * respuesta del servidor.
 */
@Injectable({ providedIn: 'root' })
export class UserDataService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly auth = inject(AuthService);
  private readonly categoriasApi = inject(CategoriasApiService);
  private readonly movimientosApi = inject(MovimientosApiService);
  private readonly presupuestosApi = inject(PresupuestosApiService);
  private readonly metasApi = inject(MetasAhorroApiService);
  private readonly notificacionesApi = inject(NotificacionesApiService);

  private readonly _cargando = signal(false);
  readonly cargando = this._cargando.asReadonly();

  private readonly _categorias = signal<CategoriaApi[]>([]);
  private readonly _movimientos = signal<MovimientoApi[]>([]);
  private readonly _presupuestos = signal<PresupuestoApi[]>([]);
  private readonly _metas = signal<MetaAhorroApi[]>([]);
  private readonly _notificaciones = signal<NotificacionApi[]>([]);

  /** Perfil local (no existe todavía un endpoint de perfil de usuario en el backend). */
  private readonly _profile = signal<UserProfileDetails>({
    phone: '',
    company: '',
    address: '',
    occupation: '',
    bio: '',
  });

  readonly categorias = this._categorias.asReadonly();
  readonly categoriasIngreso = computed(() =>
    this._categorias().filter((c) => c.tipo === 'INGRESO' && c.activa),
  );
  readonly categoriasGasto = computed(() =>
    this._categorias().filter((c) => c.tipo === 'GASTO' && c.activa),
  );

  readonly currentAccountName = computed(() => this.auth.currentUser()?.name ?? 'Usuario');
  readonly currentAccountEmail = computed(() => this.auth.currentUser()?.email ?? '');
  readonly userInitials = computed(() => {
    const name = this.currentAccountName();
    return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'US';
  });

  readonly transactions = computed<Transaction[]>(() =>
    this._movimientos().map((m) => ({
      id: String(m.id),
      concept: m.descripcion || m.categoria.nombre,
      date: formatearFechaHora(m.fecha),
      amount: m.tipo === 'INGRESO' ? Number(m.monto) : -Number(m.monto),
      type: m.tipo === 'INGRESO' ? 'ingreso' : 'egreso',
      category: m.categoria.nombre,
      categoriaId: m.categoriaId,
      icon: m.tipo === 'INGRESO' ? '💵' : '💸',
      status: 'Completado',
    })),
  );

  readonly savingsGoals = computed<SavingGoal[]>(() =>
    this._metas().map((meta) => ({
      id: String(meta.id),
      name: meta.nombre,
      target: Number(meta.montoObjetivo),
      current: Number(meta.montoAhorrado),
      color: colorPorEstadoMeta(meta.estado),
      icon: meta.estado === 'COMPLETADA' ? '✅' : '🎯',
      deadline: meta.fechaObjetivo,
      category: 'Ahorro Personal',
    })),
  );

  readonly budgets = computed<BudgetItem[]>(() =>
    this._presupuestos().map((p) => ({
      id: String(p.id),
      category: p.categoria.nombre,
      categoriaId: p.categoria.id,
      spent: Number(p.montoGastado),
      limit: Number(p.montoLimite),
      color: colorPorEstadoPresupuesto(p.estado),
      icon: '🛒',
    })),
  );

  readonly notifications = computed<AppNotification[]>(() =>
    this._notificaciones().map((n) => ({
      id: n.id,
      type: tipoNotifAApp(n.tipo),
      title: n.titulo,
      body: n.mensaje,
      time: formatearFechaHora(n.creadoEn),
      read: n.leida,
      category: categoriaNotifAApp(n.tipo),
    })),
  );

  readonly totalBalance = computed(() => this.monthlyIncome() - this.monthlyExpenses());
  readonly monthlyIncome = computed(() =>
    this.transactions()
      .filter((t) => t.type === 'ingreso')
      .reduce((acc, t) => acc + t.amount, 0),
  );
  readonly monthlyExpenses = computed(() =>
    this.transactions()
      .filter((t) => t.type === 'egreso')
      .reduce((acc, t) => acc + Math.abs(t.amount), 0),
  );
  readonly savingsRate = computed(() => {
    const inc = this.monthlyIncome();
    const exp = this.monthlyExpenses();
    if (!inc) return 0;
    return Math.max(0, Math.round(((inc - exp) / inc) * 1000) / 10);
  });

  readonly profile = this._profile.asReadonly();

  constructor() {
    // Cuando cambia la sesión (login/logout) recarga o limpia los datos.
    effect(() => {
      const user = this.auth.currentUser();
      if (user) {
        void this.cargarTodo();
        this.restaurarPerfilLocal(user);
      } else {
        this.limpiar();
      }
    });
  }

  private restaurarPerfilLocal(user: AuthUser): void {
    if (!this.isBrowser) return;
    const raw = localStorage.getItem(`fintech_perfil_${user.email.toLowerCase()}`);
    if (!raw) return;
    try {
      this._profile.set({ ...this._profile(), ...(JSON.parse(raw) as Partial<UserProfileDetails>) });
    } catch {
      // Ignora datos corruptos.
    }
  }

  async cargarTodo(): Promise<void> {
    this._cargando.set(true);
    try {
      const [categorias, movimientos, presupuestos, metas, notificaciones] = await Promise.all([
        this.categoriasApi.listar().catch(() => []),
        this.movimientosApi.listar().catch(() => []),
        this.presupuestosApi.listar().catch(() => []),
        this.metasApi.listar().catch(() => []),
        this.notificacionesApi.sincronizar().catch(() => this.notificacionesApi.listar().catch(() => [])),
      ]);
      this._categorias.set(categorias);
      this._movimientos.set(movimientos);
      this._presupuestos.set(presupuestos);
      this._metas.set(metas);
      this._notificaciones.set(notificaciones);
    } finally {
      this._cargando.set(false);
    }
  }

  private limpiar(): void {
    this._categorias.set([]);
    this._movimientos.set([]);
    this._presupuestos.set([]);
    this._metas.set([]);
    this._notificaciones.set([]);
  }

  /* ── MOVIMIENTOS ── */
  async addTransaction(datos: {
    concept: string;
    amount: number;
    type: 'ingreso' | 'egreso';
    categoriaId: number;
    date?: string;
  }): Promise<void> {
    await this.movimientosApi.crear({
      tipo: datos.type === 'ingreso' ? 'INGRESO' : 'GASTO',
      categoriaId: datos.categoriaId,
      monto: Math.abs(datos.amount),
      descripcion: datos.concept,
    });
    const movimientos = await this.movimientosApi.listar();
    this._movimientos.set(movimientos);
    // Los presupuestos y notificaciones pueden verse afectados por el nuevo gasto.
    void this.refrescarPresupuestosYNotificaciones();
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.movimientosApi.eliminar(Number(id));
    this._movimientos.set(this._movimientos().filter((m) => String(m.id) !== id));
    void this.refrescarPresupuestosYNotificaciones();
  }

  /* ── PRESUPUESTOS ── */
  async addBudget(datos: { categoriaId: number; limit: number }): Promise<void> {
    const ahora = new Date();
    await this.presupuestosApi.crear({
      categoriaId: datos.categoriaId,
      montoLimite: datos.limit,
      mes: ahora.getMonth() + 1,
      anio: ahora.getFullYear(),
    });
    this._presupuestos.set(await this.presupuestosApi.listar());
  }

  async deleteBudget(id: string): Promise<void> {
    await this.presupuestosApi.eliminar(Number(id));
    this._presupuestos.set(this._presupuestos().filter((p) => String(p.id) !== id));
  }

  private async refrescarPresupuestosYNotificaciones(): Promise<void> {
    const [presupuestos, notificaciones] = await Promise.all([
      this.presupuestosApi.listar().catch(() => this._presupuestos()),
      this.notificacionesApi.sincronizar().catch(() => this._notificaciones()),
    ]);
    this._presupuestos.set(presupuestos);
    this._notificaciones.set(notificaciones);
  }

  /* ── METAS DE AHORRO ── */
  async addSavingGoal(datos: { name: string; target: number; deadline: string; initial?: number }): Promise<void> {
    const meta = await this.metasApi.crear({
      nombre: datos.name,
      montoObjetivo: datos.target,
      fechaObjetivo: datos.deadline,
    });
    if (datos.initial && datos.initial > 0) {
      await this.metasApi.registrarAporte(meta.id, datos.initial);
    }
    this._metas.set(await this.metasApi.listar());
  }

  async addGoalDeposit(goalId: string, amount: number): Promise<void> {
    await this.metasApi.registrarAporte(Number(goalId), amount);
    this._metas.set(await this.metasApi.listar());
  }

  async deleteSavingGoal(id: string): Promise<void> {
    await this.metasApi.eliminar(Number(id));
    this._metas.set(this._metas().filter((m) => String(m.id) !== id));
  }

  /* ── NOTIFICACIONES ── */
  async markNotificationRead(id: number): Promise<void> {
    await this.notificacionesApi.marcarLeida(id);
    this._notificaciones.set(
      this._notificaciones().map((n) => (n.id === id ? { ...n, leida: true } : n)),
    );
  }

  async clearAllNotifications(): Promise<void> {
    await this.notificacionesApi.marcarTodasLeidas();
    this._notificaciones.set(this._notificaciones().map((n) => ({ ...n, leida: true })));
  }

  /* ── PERFIL (local; el backend todavía no expone estos campos) ── */
  updateProfile(profile: Partial<UserProfileDetails>): void {
    const actualizado = { ...this._profile(), ...profile };
    this._profile.set(actualizado);
    const email = this.auth.currentUser()?.email;
    if (this.isBrowser && email) {
      localStorage.setItem(`fintech_perfil_${email.toLowerCase()}`, JSON.stringify(actualizado));
    }
  }
}

function formatearFechaHora(iso: string): string {
  try {
    const fecha = new Date(iso);
    const hoy = new Date();
    const esHoy = fecha.toDateString() === hoy.toDateString();
    const hora = fecha.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
    return esHoy ? `Hoy, ${hora}` : `${fecha.toLocaleDateString('es-EC')}, ${hora}`;
  } catch {
    return iso;
  }
}

function colorPorEstadoMeta(estado: string): string {
  if (estado === 'COMPLETADA') return '#34d399';
  if (estado === 'VENCIDA') return '#f87171';
  return '#06b6d4';
}

function colorPorEstadoPresupuesto(estado: string): string {
  if (estado === 'EXCEDIDO') return '#f87171';
  if (estado === 'EN_ALERTA' || estado === 'LIMITE_ALCANZADO') return '#fbbf24';
  return '#06b6d4';
}

function tipoNotifAApp(tipo: NotificacionApi['tipo']): AppNotification['type'] {
  switch (tipo) {
    case 'ALERTA_PRESUPUESTO':
      return 'alerta';
    case 'META_AHORRO':
      return 'exito';
    case 'RECORDATORIO_PAGO':
    case 'RECORDATORIO_MOVIMIENTO':
      return 'warning';
    case 'RECOMENDACION_IA':
      return 'info';
    default:
      return 'info';
  }
}

function categoriaNotifAApp(tipo: NotificacionApi['tipo']): AppNotification['category'] {
  if (tipo === 'ALERTA_PRESUPUESTO' || tipo === 'RECORDATORIO_PAGO' || tipo === 'RECORDATORIO_MOVIMIENTO') {
    return 'alerta';
  }
  if (tipo === 'SISTEMA') return 'sistema';
  return 'info';
}

export type { AuthUser };
