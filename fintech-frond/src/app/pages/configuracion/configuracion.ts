import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';

import { UsuariosApiService } from '../../services/api/usuarios.api';
import { mensajeDeError } from '../../services/http-error';

@Component({
  selector: 'app-configuracion',
  imports: [RouterLink],
  templateUrl: './configuracion.html',
  styleUrl: './configuracion.css',
})
export class Configuracion implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('neuralCanvas') private canvasRef?: ElementRef<HTMLCanvasElement>;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly usuariosApi = inject(UsuariosApiService);

  private animationFrameId?: number;
  private resizeHandler?: () => void;

  readonly activeTab = signal<'general' | 'integraciones' | 'notificaciones' | 'api'>('general');
  readonly toastMessage = signal<string | null>(null);

  // Settings Signals
  readonly companyName = signal('Mi Empresa SA de CV');
  readonly rfc = signal('XAXX010101000');
  readonly fiscalRegime = signal('601 - General de Ley Personas Morales');
  
  // Toggles
  readonly satAutoSync = signal(true);
  readonly pushNotifications = signal(true);
  readonly emailDigest = signal(true);
  readonly aiAutoInsights = signal(true);
  readonly twoFactorAuth = signal(false);

  // Clave personal de Gemini (Configuración > Asistente IA).
  readonly showApiKey = signal(false);
  readonly geminiApiKeyInput = signal('');
  readonly geminiApiKeyGuardada = signal(false);
  readonly cargandoClaveGemini = signal(true);
  readonly guardandoClaveGemini = signal(false);
  readonly errorClaveGemini = signal<string | null>(null);

  ngOnInit(): void {
    void this.cargarClaveGemini();
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      this.initNeuralCanvas();
    }
  }

  private async cargarClaveGemini(): Promise<void> {
    try {
      const clave = await this.usuariosApi.obtenerClaveGemini();
      this.geminiApiKeyInput.set(clave ?? '');
      this.geminiApiKeyGuardada.set(!!clave);
    } catch (error) {
      this.errorClaveGemini.set(
        mensajeDeError(error, 'No se pudo cargar tu clave de Gemini.'),
      );
    } finally {
      this.cargandoClaveGemini.set(false);
    }
  }

  async guardarClaveGemini(): Promise<void> {
    this.guardandoClaveGemini.set(true);
    this.errorClaveGemini.set(null);
    try {
      const clave = await this.usuariosApi.guardarClaveGemini(
        this.geminiApiKeyInput().trim() || null,
      );
      this.geminiApiKeyInput.set(clave ?? '');
      this.geminiApiKeyGuardada.set(!!clave);
      this.triggerToast(
        clave
          ? '¡Clave de Gemini guardada! El asistente ya puede usarla. ✨'
          : 'Clave de Gemini eliminada. El asistente usará el motor local.',
      );
    } catch (error) {
      this.errorClaveGemini.set(
        mensajeDeError(error, 'No se pudo guardar tu clave de Gemini.'),
      );
    } finally {
      this.guardandoClaveGemini.set(false);
    }
  }

  async eliminarClaveGemini(): Promise<void> {
    this.geminiApiKeyInput.set('');
    await this.guardarClaveGemini();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== undefined) cancelAnimationFrame(this.animationFrameId);
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
  }

  setTab(tab: 'general' | 'integraciones' | 'notificaciones' | 'api') {
    this.activeTab.set(tab);
  }

  toggleSatSync() {
    this.satAutoSync.update((v) => !v);
  }

  togglePush() {
    this.pushNotifications.update((v) => !v);
  }

  toggleEmail() {
    this.emailDigest.update((v) => !v);
  }

  toggleAi() {
    this.aiAutoInsights.update((v) => !v);
  }

  toggle2FA() {
    this.twoFactorAuth.update((v) => !v);
  }

  toggleShowApiKey() {
    this.showApiKey.update((v) => !v);
  }

  saveSettings() {
    this.triggerToast('¡Configuración guardada exitosamente! ⚙️✨');
  }

  private triggerToast(msg: string) {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(null), 3500);
  }

  private initNeuralCanvas(): void {
    // Fondo estático y limpio
  }
}
