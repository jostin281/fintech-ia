import { Component, PLATFORM_ID, afterNextRender, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { DomTranslatorService } from './services/dom-translator';
import { AuthService } from './services/auth';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('fintech-frond');

  private readonly domTranslator = inject(DomTranslatorService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      afterNextRender(() => this.domTranslator.start());
    }
  }

  /** Botón de la pantalla de fin de demo: cierra la sesión demo y manda a crear una cuenta real. */
  protected crearCuentaGratis(): void {
    this.auth.logout();
    this.router.navigate(['/login'], { queryParams: { modo: 'registro' } });
  }
}
