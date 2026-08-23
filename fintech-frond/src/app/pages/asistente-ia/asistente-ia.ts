import {
  AfterViewChecked,
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';

import { AsistenteIaApiService } from '../../services/api/asistente-ia.api';
import { AsistenteContextoService } from '../../services/asistente-contexto';
import { UsuariosApiService } from '../../services/api/usuarios.api';
import { mensajeDeError } from '../../services/http-error';

interface Message {
  id: number;
  sender: 'user' | 'ai';
  text: string;
  time: string;
  isGemini?: boolean;
}

/**
 * Chat conectado al backend real: POST /api/asistente-ia/conversaciones y
 * POST /api/asistente-ia/conversaciones/:id/mensajes. El backend decide si
 * responde con Google Gemini (si GEMINI_API_KEY está configurada en
 * fintech-back/.env) o con su motor de reglas local; aquí solo se muestra
 * la insignia "Gemini" cuando origenRespuesta === 'GEMINI'.
 */
@Component({
  selector: 'app-asistente-ia',
  imports: [RouterLink],
  templateUrl: './asistente-ia.html',
  styleUrl: './asistente-ia.css',
})
export class AsistenteIa implements AfterViewInit, AfterViewChecked, OnDestroy {
  @ViewChild('chatContainer') private chatContainer!: ElementRef;
  @ViewChild('neuralCanvas') private canvasRef?: ElementRef<HTMLCanvasElement>;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly asistenteApi = inject(AsistenteIaApiService);
  private readonly contextoIA = inject(AsistenteContextoService);
  private readonly usuariosApi = inject(UsuariosApiService);

  private animationFrameId?: number;
  private resizeHandler?: () => void;
  private conversacionId: number | null = null;

  readonly inputMessage = signal('');
  readonly isTyping = signal(false);
  readonly iniciando = signal(true);
  readonly toastMessage = signal<string | null>(null);
  /** Se activa en cuanto el backend responde alguna vez con origenRespuesta = GEMINI. */
  readonly geminiActivo = signal(false);

  // Modal para pegar/editar la clave personal de Gemini sin salir del chat.
  readonly mostrarModalClave = signal(false);
  readonly claveGeminiInput = signal('');
  readonly claveGeminiGuardada = signal(false);
  readonly mostrarClaveTexto = signal(false);
  readonly guardandoClave = signal(false);
  readonly errorClave = signal<string | null>(null);

  readonly messages = signal<Message[]>([
    {
      id: 1,
      sender: 'ai',
      text: '¡Hola! Soy tu Copiloto Financiero. Puedo ayudarte con tus Movimientos, Presupuestos, Metas de Ahorro, Facturación SRI Ecuador, Reportes e Impuestos. ¿En qué te puedo ayudar hoy?',
      time: horaActual(),
    },
  ]);

  readonly suggestions = [
    { label: '📊 Resumen general (Dashboard)', prompt: 'Explícame las métricas del Dashboard y cómo optimizar mi flujo de caja' },
    { label: '🇪🇨 Ayuda Facturación SRI Ecuador', prompt: '¿Cómo emito una factura electrónica SRI con RUC/Cédula e IVA 15%?' },
    { label: '🎯 Estrategia de Metas & Presupuestos', prompt: '¿Cómo puedo reasignar excedentes de presupuesto para cumplir mis metas de ahorro?' },
    { label: '📈 Mis gastos de este mes', prompt: '¿En qué categoría gasté más este mes?' },
  ];

  async ngAfterViewInit(): Promise<void> {
    if (this.isBrowser) {
      this.initNeuralCanvas();
      await this.iniciarConversacion();
      await this.cargarClaveGemini();

      // Si otra pantalla (por ejemplo Impuestos) dejó un mensaje precargado
      // pidiendo consejo, lo enviamos automáticamente al abrir el chat.
      const promptPendiente = this.contextoIA.consumirPromptPendiente();
      if (promptPendiente) {
        await this.sendMessage(promptPendiente);
      }
    }
  }

  private async cargarClaveGemini(): Promise<void> {
    try {
      const clave = await this.usuariosApi.obtenerClaveGemini();
      this.claveGeminiInput.set(clave ?? '');
      this.claveGeminiGuardada.set(!!clave);
    } catch {
      // Si falla, simplemente no se precarga; el usuario puede intentar guardar de nuevo.
    }
  }

  abrirModalClave(): void {
    this.errorClave.set(null);
    this.mostrarModalClave.set(true);
  }

  cerrarModalClave(): void {
    this.mostrarModalClave.set(false);
  }

  toggleMostrarClaveTexto(): void {
    this.mostrarClaveTexto.update((v) => !v);
  }

  async guardarClaveGemini(): Promise<void> {
    this.guardandoClave.set(true);
    this.errorClave.set(null);
    try {
      const clave = await this.usuariosApi.guardarClaveGemini(
        this.claveGeminiInput().trim() || null,
      );
      this.claveGeminiInput.set(clave ?? '');
      this.claveGeminiGuardada.set(!!clave);
      this.triggerToast(
        clave
          ? '¡Clave de Gemini guardada! Tus próximos mensajes usarán IA real. ✨'
          : 'Clave de Gemini eliminada. Volverás al motor de reglas local.',
      );
      this.mostrarModalClave.set(false);
    } catch (error) {
      this.errorClave.set(mensajeDeError(error, 'No se pudo guardar tu clave de Gemini.'));
    } finally {
      this.guardandoClave.set(false);
    }
  }

  async quitarClaveGemini(): Promise<void> {
    this.claveGeminiInput.set('');
    await this.guardarClaveGemini();
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== undefined) cancelAnimationFrame(this.animationFrameId);
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
  }

  private async iniciarConversacion(): Promise<void> {
    this.iniciando.set(true);
    try {
      const conversaciones = await this.asistenteApi.listarConversaciones();
      if (conversaciones.length > 0) {
        // Reutiliza la conversación más reciente y carga su historial.
        const ultima = conversaciones[0];
        const detalle = await this.asistenteApi.obtenerConversacion(ultima.id);
        this.conversacionId = detalle.id;
        if (detalle.mensajes.length > 0) {
          this.messages.set(
            detalle.mensajes.map((m) => ({
              id: m.id,
              sender: m.rol === 'USUARIO' ? 'user' : 'ai',
              text: m.contenido,
              time: horaDe(m.creadoEn),
              isGemini: m.origenRespuesta === 'GEMINI',
            })),
          );
          if (detalle.mensajes.some((m) => m.origenRespuesta === 'GEMINI')) {
            this.geminiActivo.set(true);
          }
        }
      } else {
        const nueva = await this.asistenteApi.crearConversacion('Chat con el Copiloto Financiero');
        this.conversacionId = nueva.id;
      }
    } catch (error) {
      this.triggerToast(mensajeDeError(error, 'No se pudo conectar con el asistente.'));
    } finally {
      this.iniciando.set(false);
    }
  }

  updateInput(event: Event) {
    this.inputMessage.set((event.target as HTMLInputElement).value);
  }

  nuevaConversacion(): void {
    void (async () => {
      try {
        const nueva = await this.asistenteApi.crearConversacion(
          `Chat ${new Date().toLocaleDateString('es-EC')}`,
        );
        this.conversacionId = nueva.id;
        this.messages.set([this.messages()[0]]);
      } catch (error) {
        this.triggerToast(mensajeDeError(error, 'No se pudo iniciar una nueva conversación.'));
      }
    })();
  }

  async sendMessage(text: string = this.inputMessage()) {
    if (!text.trim() || this.isTyping() || !this.conversacionId) return;

    const queryText = text.trim();

    this.messages.update((msgs) => [
      ...msgs,
      { id: Date.now(), sender: 'user', text: queryText, time: horaActual() },
    ]);

    this.inputMessage.set('');
    this.isTyping.set(true);

    try {
      const resultado = await this.asistenteApi.enviarMensaje(this.conversacionId, queryText);
      const esGemini = resultado.respuesta.origenRespuesta === 'GEMINI';
      if (esGemini) this.geminiActivo.set(true);

      this.messages.update((msgs) => [
        ...msgs,
        {
          id: resultado.respuesta.id,
          sender: 'ai',
          text: resultado.respuesta.contenido,
          time: horaDe(resultado.respuesta.creadoEn),
          isGemini: esGemini,
        },
      ]);
    } catch (error) {
      this.messages.update((msgs) => [
        ...msgs,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: `⚠️ ${mensajeDeError(error, 'No se pudo contactar al asistente. Intenta de nuevo.')}`,
          time: horaActual(),
        },
      ]);
    } finally {
      this.isTyping.set(false);
    }
  }

  private scrollToBottom(): void {
    try {
      this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
    } catch {
      // El contenedor todavía no existe en el primer render; se ignora.
    }
  }

  private triggerToast(msg: string) {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(null), 3500);
  }

  private initNeuralCanvas(): void {
    // Fondo estático y limpio
  }
}

function horaActual(): string {
  const now = new Date();
  return `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
}

function horaDe(iso: string): string {
  try {
    const fecha = new Date(iso);
    return `${fecha.getHours()}:${fecha.getMinutes().toString().padStart(2, '0')}`;
  } catch {
    return horaActual();
  }
}
