import { Injectable, signal } from '@angular/core';

/**
 * Puente simple para pasarle un "prompt" precargado al Asistente IA desde
 * otras pantallas (por ejemplo, desde Impuestos) sin acoplar esas páginas
 * al componente de chat. La página de origen llama a
 * `establecerPromptPendiente(...)` y navega a /asistente-ia; el chat, al
 * iniciar su conversación, llama a `consumirPromptPendiente()` y si hay
 * algo pendiente lo envía automáticamente como si el usuario lo hubiera
 * escrito.
 */
@Injectable({ providedIn: 'root' })
export class AsistenteContextoService {
  private readonly promptPendiente = signal<string | null>(null);

  establecerPromptPendiente(prompt: string): void {
    this.promptPendiente.set(prompt);
  }

  consumirPromptPendiente(): string | null {
    const prompt = this.promptPendiente();
    this.promptPendiente.set(null);
    return prompt;
  }
}
