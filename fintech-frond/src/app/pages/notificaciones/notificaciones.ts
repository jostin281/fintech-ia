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
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { UserDataService } from '../../services/user-data';

export type NotifType = 'alerta' | 'info' | 'exito' | 'warning' | 'critica';
export type FilterType = 'todas' | 'no-leidas' | 'alertas' | 'sistema';

export interface Notificacion {
  id: number;
  type: NotifType;
  title: string;
  body: string;
  time: string;
  read: boolean;
  category: 'alerta' | 'sistema' | 'info';
  actionUrl?: string;
  actionText?: string;
}

@Component({
  selector: 'app-notificaciones',
  imports: [RouterLink],
  templateUrl: './notificaciones.html',
  styleUrl: './notificaciones.css',
})
export class Notificaciones implements AfterViewInit, OnDestroy {
  @ViewChild('neuralCanvas') private canvasRef?: ElementRef<HTMLCanvasElement>;

  protected readonly userData = inject(UserDataService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly router = inject(Router);

  private animationFrameId?: number;
  private resizeHandler?: () => void;

  readonly filter = signal<FilterType>('todas');
  readonly showClearConfirm = signal(false);
  readonly selectedNotif = signal<Notificacion | null>(null);

  readonly items = computed<Notificacion[]>(() => {
    return this.userData.notifications().map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      time: n.time,
      read: n.read,
      category: n.category,
      actionUrl: n.actionUrl,
      actionText: n.actionText,
    }));
  });

  readonly unreadCount = computed(() => this.items().filter((n) => !n.read).length);

  readonly criticalCount = computed(
    () => this.items().filter((n) => n.type === 'critica' || n.type === 'warning').length
  );

  readonly filtered = computed(() => {
    const f = this.filter();
    return this.items().filter((n) => {
      if (f === 'no-leidas') return !n.read;
      if (f === 'alertas') return n.category === 'alerta';
      if (f === 'sistema') return n.category === 'sistema';
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

  openNotifModal(notif: Notificacion) {
    this.selectedNotif.set(notif);
    this.markRead(notif.id);
  }

  closeNotifModal() {
    this.selectedNotif.set(null);
  }

  navigateToSection(url?: string) {
    if (url) {
      this.closeNotifModal();
      this.router.navigateByUrl(url);
    }
  }

  setFilter(f: FilterType) {
    this.filter.set(f);
  }

  markRead(id: number) {
    this.userData.markNotificationRead(id);
  }

  markAllRead() {
    this.userData.notifications().forEach((n) => this.userData.markNotificationRead(n.id));
  }

  clearAll() {
    this.userData.clearAllNotifications();
    this.showClearConfirm.set(false);
  }

  deleteNotif(id: number) {
    this.userData.markNotificationRead(id);
  }

  typeColor(type: NotifType): string {
    return {
      critica: '#ef4444',
      alerta: '#f87171',
      info: '#22d3ee',
      exito: '#34d399',
      warning: '#fbbf24',
    }[type];
  }

  typeBg(type: NotifType): string {
    return {
      critica: 'rgba(239, 68, 68, 0.18)',
      alerta: 'rgba(248, 113, 113, 0.14)',
      info: 'rgba(34, 211, 238, 0.14)',
      exito: 'rgba(52, 211, 153, 0.14)',
      warning: 'rgba(251, 191, 36, 0.14)',
    }[type];
  }

  typeBorder(type: NotifType): string {
    return {
      critica: 'rgba(239, 68, 68, 0.4)',
      alerta: 'rgba(248, 113, 113, 0.3)',
      info: 'rgba(34, 211, 238, 0.3)',
      exito: 'rgba(52, 211, 153, 0.3)',
      warning: 'rgba(251, 191, 36, 0.3)',
    }[type];
  }

  typeIcon(type: NotifType): string {
    return { critica: '🚨', alerta: '🛑', info: 'ℹ️', exito: '✨', warning: '⚠️' }[type];
  }

  private initNeuralCanvas(): void {
    // Fondo estático y limpio
  }
}
