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
import { AuthService } from '../../services/auth';
import { AppLanguage, LanguageService } from '../../services/language';
import { ThemeService } from '../../services/theme';
import { UserDataService } from '../../services/user-data';

interface StatCard { label: string; value: string; icon: string; color: string; }
interface ActivityItem { action: string; time: string; icon: string; color: string; }

@Component({
  selector: 'app-perfil',
  imports: [RouterLink],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
})
export class Perfil implements AfterViewInit, OnDestroy {
  @ViewChild('neuralCanvas') private canvasRef?: ElementRef<HTMLCanvasElement>;

  protected readonly auth = inject(AuthService);
  protected readonly userData = inject(UserDataService);
  protected readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly languageService = inject(LanguageService);

  readonly lang = this.languageService.lang;

  private animationFrameId?: number;
  private resizeHandler?: () => void;

  readonly user = this.auth.currentUser;
  readonly userInitials = this.userData.userInitials;
  readonly profileData = this.userData.profile;

  readonly activeTab = signal<'general' | 'seguridad' | 'preferencias'>('general');
  readonly editMode = signal(false);
  readonly saveSuccess = signal(false);

  /* ── Seguridad ── */
  readonly contrasenaActual = signal('');
  readonly nuevaContrasena = signal('');
  readonly confirmarContrasena = signal('');
  readonly guardandoContrasena = signal(false);
  readonly mensajeSeguridad = signal<string | null>(null);
  readonly errorSeguridad = signal(false);
  readonly twoFactorActivo = signal(false);
  readonly sesiones = signal([
    { id: 1, dispositivo: 'Chrome · Windows 11', ip: '189.240.x.x', fecha: 'Hace 2 minutos', actual: true },
    { id: 2, dispositivo: 'Safari · iPhone 15', ip: '201.163.x.x', fecha: 'Hace 2 días', actual: false },
  ]);

  readonly stats = computed<StatCard[]>(() => [
    { label: 'Transacciones', value: this.userData.transactions().length.toString(), icon: 'swap', color: '#22d3ee' },
    { label: 'Presupuestos', value: this.userData.budgets().length.toString(), icon: 'chart', color: '#a78bfa' },
    { label: 'Metas activas', value: this.userData.savingsGoals().length.toString(), icon: 'target', color: '#34d399' },
    { label: 'Ahorro total', value: `$${this.userData.savingsGoals().reduce((acc, g) => acc + g.current, 0).toLocaleString()}`, icon: 'money', color: '#fbbf24' },
  ]);

  readonly activity: ActivityItem[] = [
    { action: 'Inicio de sesión desde Chrome / Windows', time: 'Hace 2 minutos', icon: 'login', color: '#22d3ee' },
    { action: 'Perfil actualizado dinámicamente', time: 'Hace 1 hora', icon: 'edit', color: '#a78bfa' },
    { action: 'Cuenta aislada y protegida', time: 'Hoy', icon: 'shield', color: '#34d399' },
  ];

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      this.initNeuralCanvas();
    }
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== undefined) cancelAnimationFrame(this.animationFrameId);
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
  }

  setTab(tab: 'general' | 'seguridad' | 'preferencias') {
    this.activeTab.set(tab);
    this.editMode.set(false);
    this.mensajeSeguridad.set(null);
  }

  toggleEdit() {
    this.editMode.update(v => !v);
    this.saveSuccess.set(false);
  }

  saveChanges() {
    this.editMode.set(false);
    this.saveSuccess.set(true);
    setTimeout(() => this.saveSuccess.set(false), 3000);
  }

  async actualizarContrasena() {
    const actual = this.contrasenaActual().trim();
    const nueva = this.nuevaContrasena().trim();
    const confirmar = this.confirmarContrasena().trim();

    if (!actual) {
      this.mostrarMensajeSeguridad('Ingresa tu contraseña actual.', true);
      return;
    }

    if (nueva.length < 11) {
      this.mostrarMensajeSeguridad('La nueva contraseña debe tener al menos 11 caracteres para ser una contraseña fuerte.', true);
      return;
    }

    if (nueva !== confirmar) {
      this.mostrarMensajeSeguridad('La nueva contraseña y la confirmación no coinciden.', true);
      return;
    }

    this.guardandoContrasena.set(true);
    try {
      const res = await this.auth.cambiarContrasena(actual, nueva);
      if (res.success) {
        this.contrasenaActual.set('');
        this.nuevaContrasena.set('');
        this.confirmarContrasena.set('');
        this.mostrarMensajeSeguridad('✅ Contraseña actualizada correctamente.', false);
      } else {
        this.mostrarMensajeSeguridad(res.message || 'Error al actualizar la contraseña.', true);
      }
    } catch {
      this.mostrarMensajeSeguridad('No se pudo conectar con el servidor.', true);
    } finally {
      this.guardandoContrasena.set(false);
    }
  }

  toggleTwoFactor() {
    const nuevoEstado = !this.twoFactorActivo();
    this.twoFactorActivo.set(nuevoEstado);
    this.mostrarMensajeSeguridad(
      nuevoEstado
        ? '✅ Autenticación de dos factores (2FA) activada correctamente.'
        : 'ℹ️ Autenticación de dos factores (2FA) desactivada.',
      false,
    );
  }

  revocarSesion(id: number) {
    this.sesiones.update(s => s.filter(item => item.id !== id));
    this.mostrarMensajeSeguridad('Sesión revocada correctamente.', false);
  }

  private mostrarMensajeSeguridad(texto: string, esError: boolean) {
    this.mensajeSeguridad.set(texto);
    this.errorSeguridad.set(esError);
    setTimeout(() => {
      if (this.mensajeSeguridad() === texto) this.mensajeSeguridad.set(null);
    }, 5000);
  }

  logout() {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  setLang(lang: string): void {
    if (lang === 'en' || lang === 'es') {
      this.languageService.setLang(lang as AppLanguage);
    }
  }

  private initNeuralCanvas(): void {
    // Fondo estático y limpio
  }
}
