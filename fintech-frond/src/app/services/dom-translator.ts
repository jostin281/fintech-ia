import { Injectable, PLATFORM_ID, effect, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LanguageService } from './language';
import { ES_EN_DICTIONARY, ES_EN_PATTERNS } from '../i18n/dictionary';

const TRANSLATABLE_ATTRS = ['placeholder', 'title', 'aria-label'] as const;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE']);

/**
 * Traduce el DOM ya renderizado en tiempo de ejecución, sin tener que tocar
 * cada plantilla individualmente. Recorre nodos de texto y atributos
 * traducibles (placeholder/title/aria-label), guarda el original en un
 * WeakMap y aplica una búsqueda exacta contra ES_EN_DICTIONARY.
 *
 * Reacciona a LanguageService.lang() mediante un effect(): al cambiar a
 * 'en' traduce todo lo visible; al volver a 'es' restaura los originales.
 * Un MutationObserver cubre contenido añadido dinámicamente después
 * (modales, listas con @for, toasts, etc.).
 */
@Injectable({ providedIn: 'root' })
export class DomTranslatorService {
  private readonly languageService = inject(LanguageService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly originalText = new WeakMap<Text, string>();
  private readonly originalAttrs = new WeakMap<Element, Partial<Record<string, string>>>();

  private observer?: MutationObserver;

  constructor() {
    // effect() solo puede crearse dentro de un contexto de inyección: por eso
    // vive en el constructor (llamado por Angular al inyectar el servicio),
    // en vez de en un método invocado más tarde desde afterNextRender().
    if (!this.isBrowser) return;

    effect(() => {
      const lang = this.languageService.lang();
      this.applyLanguage(lang === 'en');
    });

    this.observer = new MutationObserver((mutations) => {
      if (this.languageService.lang() !== 'en') return;
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => this.translateSubtree(node));
      }
    });
  }

  /** Activa la observación de mutaciones del DOM. Seguro de llamar varias veces. */
  start(): void {
    if (!this.isBrowser || !this.observer || !document.body) return;
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  private applyLanguage(toEnglish: boolean): void {
    if (!document.body) return;
    if (toEnglish) {
      this.translateSubtree(document.body);
    } else {
      this.restoreSubtree(document.body);
    }
  }

  private translateSubtree(root: Node): void {
    if (root.nodeType === Node.TEXT_NODE) {
      this.translateTextNode(root as Text);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) => {
        const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
        if (el && SKIP_TAGS.has(el.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let current: Node | null = walker.currentNode;
    while (current) {
      if (current.nodeType === Node.TEXT_NODE) {
        this.translateTextNode(current as Text);
      } else if (current.nodeType === Node.ELEMENT_NODE) {
        this.translateAttrs(current as Element);
      }
      current = walker.nextNode();
    }
  }

  private restoreSubtree(root: Node): void {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let current: Node | null = walker.currentNode;
    while (current) {
      if (current.nodeType === Node.TEXT_NODE) {
        const original = this.originalText.get(current as Text);
        if (original !== undefined) (current as Text).textContent = original;
      } else if (current.nodeType === Node.ELEMENT_NODE) {
        const el = current as Element;
        const attrs = this.originalAttrs.get(el);
        if (attrs) {
          for (const [name, value] of Object.entries(attrs)) {
            if (value !== undefined) el.setAttribute(name, value);
          }
        }
      }
      current = walker.nextNode();
    }
  }

  private translateTextNode(node: Text): void {
    const parentTag = node.parentElement?.tagName;
    if (parentTag && SKIP_TAGS.has(parentTag)) return;

    const raw = node.textContent ?? '';
    const trimmed = raw.trim().replace(/\s+/g, ' ');
    if (!trimmed) return;

    const translation = this.resolveTranslation(trimmed);
    if (!translation) return;

    if (!this.originalText.has(node)) {
      this.originalText.set(node, raw);
    }
    // Preserve surrounding whitespace from the original text node.
    const leading = raw.match(/^\s*/)?.[0] ?? '';
    const trailing = raw.match(/\s*$/)?.[0] ?? '';
    node.textContent = `${leading}${translation}${trailing}`;
  }

  /**
   * Resuelve la traducción de un texto ya recortado: primero por
   * coincidencia exacta en el diccionario, y si no hay match, probando la
   * pequeña lista de patrones regex para textos con valores interpolados
   * (números, nombres, etc.) incrustados en medio de frases en español.
   */
  private resolveTranslation(trimmed: string): string | null {
    const exact = ES_EN_DICTIONARY[trimmed];
    if (exact) return exact;

    for (const pattern of ES_EN_PATTERNS) {
      const match = trimmed.match(pattern.regex);
      if (match) return pattern.replace(match);
    }
    return null;
  }

  private translateAttrs(el: Element): void {
    for (const attr of TRANSLATABLE_ATTRS) {
      const value = el.getAttribute(attr);
      if (!value) continue;
      const trimmed = value.trim().replace(/\s+/g, ' ');
      const translation = this.resolveTranslation(trimmed);
      if (!translation) continue;

      const stored = this.originalAttrs.get(el) ?? {};
      if (stored[attr] === undefined) {
        stored[attr] = value;
        this.originalAttrs.set(el, stored);
      }
      el.setAttribute(attr, translation);
    }
  }
}
