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

  /* ── Canvas neuronal animado (Bolitas Flotantes Neón Gran Visibilidad) ── */
  private initNeuralCanvas(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width  = (canvas.width  = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    this.resizeHandler = () => {
      width  = canvas.width  = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', this.resizeHandler);

    interface NeuralNode {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      color: string;
      shadow: string;
    }

    const colors = [
      { fill: '#94a3b8', shadow: '#94a3b8' },
      { fill: '#64748b', shadow: '#64748b' },
      { fill: '#cbd5e1', shadow: '#cbd5e1' },
      { fill: '#475569', shadow: '#475569' },
    ];

    const nodes: NeuralNode[] = [];
    const nodeCount = Math.min(Math.floor(width / 18), 85);

    for (let i = 0; i < nodeCount; i++) {
      const palette = colors[i % colors.length];
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        radius: Math.random() * 3 + 3,
        color: palette.fill,
        shadow: palette.shadow,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 160) {
            const opacity = (1 - dist / 160) * 0.35;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(148, 163, 184, ${opacity})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        }
      }

      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > width)  node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.shadowBlur = 18;
        ctx.shadowColor = node.shadow;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      this.animationFrameId = requestAnimationFrame(render);
    };

    render();
  }
}
