import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

export type AppTheme = 'dark' | 'light';
const THEME_KEY = 'fintech_theme';

/**
 * Servicio global para gestionar el Modo Oscuro y Modo Claro de la plataforma.
 * Persiste la preferencia en localStorage y aplica/remueve la clase `.theme-light`.
 * Las pantallas de Marca (Bienvenida y Login) permanecen SIEMPRE en su diseño oscuro original.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly router = inject(Router);

  /**
   * Indica si la preferencia del usuario es modo oscuro (true = oscuro, false = claro).
   */
  readonly isDarkMode = signal<boolean>(this.readInitialDarkMode());

  constructor() {
    if (this.isBrowser) {
      this.applyTheme(this.isDarkMode());

      // Escuchar cambios de ruta para excluir automáticamente Bienvenida y Login
      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe((event: any) => {
        this.applyTheme(this.isDarkMode(), event.urlAfterRedirects || event.url);
      });
    }
  }

  setDarkMode(isDark: boolean): void {
    this.isDarkMode.set(isDark);
    if (this.isBrowser) {
      localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
      this.applyTheme(isDark);
    }
  }

  toggleTheme(): void {
    this.setDarkMode(!this.isDarkMode());
  }

  private readInitialDarkMode(): boolean {
    if (!this.isBrowser) return true;
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light') return false;
    return true; // Predeterminado modo oscuro
  }

  private applyTheme(isDark: boolean, currentUrl?: string): void {
    if (!this.isBrowser) return;
    const url = currentUrl || (window.location ? window.location.pathname : '');
    const isBrandPage = url.includes('bienvenida') || url.includes('login');

    // Si es pantalla de marca (Bienvenida/Login) o está activo el modo oscuro, remover theme-light
    if (isDark || isBrandPage) {
      document.documentElement.classList.remove('theme-light');
      document.body.classList.remove('theme-light');
    } else {
      document.documentElement.classList.add('theme-light');
      document.body.classList.add('theme-light');
    }
  }
}
