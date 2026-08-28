import {
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

type CtaState = 'idle' | 'processing' | 'success';

interface NeuralNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

@Component({
  selector: 'app-bienvenida',
  imports: [RouterLink],
  templateUrl: './bienvenida.html',
  styleUrl: './bienvenida.css',
})
export class Bienvenida implements AfterViewInit, OnDestroy {
  @ViewChild('neuralCanvas') private canvasRef?: ElementRef<HTMLCanvasElement>;

  private readonly isBrowser: boolean;
  private animationFrameId?: number;
  private resizeHandler?: () => void;

  readonly ctaState = signal<CtaState>('idle');
  readonly isProcessing = computed(() => this.ctaState() === 'processing');
  readonly isSuccess = computed(() => this.ctaState() === 'success');

  readonly badgeText = computed(() => {
    switch (this.ctaState()) {
      case 'processing':
        return '● Sincronizando Red IA...';
      case 'success':
        return '● Modelo Optimizado Live';
      default:
        return '● IA Live Active';
    }
  });

  readonly badgeClasses = computed(() => {
    const base =
      'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-500 border';
    return this.ctaState() === 'processing'
      ? `${base} bg-cyan-950/80 border-cyan-400/60 text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.4)] animate-pulse`
      : `${base} bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)]`;
  });

  readonly badgeDotClasses = computed(() =>
    this.ctaState() === 'processing' ? 'bg-cyan-400' : 'bg-emerald-500',
  );
  readonly badgePingClasses = computed(() =>
    this.ctaState() === 'processing' ? 'bg-cyan-400' : 'bg-emerald-400',
  );

  constructor(
    private readonly router: Router,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      this.initNeuralCanvas();
    }
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== undefined) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
  }

  onComenzar(): void {
    if (this.ctaState() !== 'idle') return;

    this.ctaState.set('processing');

    setTimeout(() => {
      this.ctaState.set('success');
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 850);
    }, 1300);
  }

  /* ── Fondo del canvas desactivado: sin animación, más limpio ── */
  private initNeuralCanvas(): void {
    // Fondo estático y limpio; antes dibujaba una red de partículas
    // animada de fondo, se desactivó para evitar distracciones visuales.
  }
}
