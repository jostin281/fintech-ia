import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type AppLanguage = 'es' | 'en';

const LANG_KEY = 'fintech_lang';

/**
 * Preferencia de idioma de la plataforma (Español / English).
 * Se persiste en localStorage y se lee al arrancar la app.
 * La traducción real del DOM la aplica DomTranslatorService, que reacciona
 * a cambios en `lang` mediante un `effect()`.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly lang = signal<AppLanguage>(this.readInitialLang());

  setLang(lang: AppLanguage): void {
    this.lang.set(lang);
    if (this.isBrowser) {
      localStorage.setItem(LANG_KEY, lang);
    }
  }

  toggle(): void {
    this.setLang(this.lang() === 'es' ? 'en' : 'es');
  }

  private readInitialLang(): AppLanguage {
    if (!this.isBrowser) return 'es';
    const saved = localStorage.getItem(LANG_KEY);
    return saved === 'en' ? 'en' : 'es';
  }
}
