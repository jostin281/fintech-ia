import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';

interface FeatureSlide {
  icon: string;
  title: string;
  description: string;
}

interface CarouselSlide {
  id: number;
  badge: string;
  badgeBg: string;
  badgeColor: string;
  badgeBorder: string;
  category: string;
  accentColor: string;
  title: string;
  description: string;
  svgScene: SafeHtml;
}

type AuthMode = 'login' | 'register' | 'forgot';
type SocialProvider = 'Google' | 'Microsoft' | 'Facebook';

function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  if (!password || !confirmPassword) return null;
  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('neuralCanvas') private canvasRef?: ElementRef<HTMLCanvasElement>;

  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private slideInterval?: ReturnType<typeof setInterval>;
  private carouselInterval?: ReturnType<typeof setInterval>;
  private animationFrameId?: number;
  private resizeHandler?: () => void;
  private redirectUrl = '/dashboard';

  /* ── Estado UI ── */
  readonly mode = signal<AuthMode>('login');
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly toastMessage = signal<string | null>(null);
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly showForgotHint = signal(false);
  readonly activeSlide = signal(0);

  /* ── Recuperación de Contraseña (WIZARD 3 PASOS) ── */
  readonly forgotStep = signal<1 | 2 | 3>(1);
  readonly forgotEmail = signal('');
  readonly forgotCode = signal('');
  readonly generatedCode = signal('849204');
  readonly forgotNewPassword = signal('');
  readonly forgotConfirmPassword = signal('');
  readonly showForgotNewPassword = signal(false);
  readonly showForgotConfirmPassword = signal(false);

  /* ── Carrusel ── */
  readonly activeCarousel = signal(0);
  readonly carouselPaused = signal(false);

  /* ── Feature slides (panel izquierdo, mantenidos por compatibilidad) ── */
  readonly slides: FeatureSlide[] = [
    {
      icon: 'chart',
      title: 'Inteligencia Financiera Global',
      description:
        'Visualiza el estado de tu negocio en tiempo real. Nuestro dashboard impulsado por IA consolida todas tus métricas clave.',
    },
    {
      icon: 'trend',
      title: 'Predicción de Flujo de Caja',
      description:
        'Anticipa entradas y salidas con modelos de aprendizaje profundo entrenados sobre tus datos financieros.',
    },
    {
      icon: 'shield',
      title: 'Seguridad de Nivel Bancario',
      description: 'Encriptación militar de 256 bits y monitoreo continuo de accesos las 24 horas.',
    },
  ];

  /* ── Carrusel de escenas ── */
  carouselSlides: CarouselSlide[] = [];

  /* ── Formularios ── */
  readonly loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    remember: [true],
  });

  readonly registerForm = this.fb.group(
    {
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      // El backend exige mínimo 8 caracteres con mayúscula, minúscula,
      // número y carácter especial (ver RegistrarUsuarioDto en fintech-back).
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/),
        ],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator },
  );

  /* ── Fuerza de contraseña ──
   * Se usa toSignal(valueChanges) en vez de leer registerForm.controls.password.value
   * directamente: un computed() solo se re-evalúa cuando cambia una señal que lee, y
   * un FormControl.value no es una señal, así que sin esto el indicador quedaba
   * "congelado" en el valor que tenía la contraseña la primera vez que se leyó. */
  private readonly passwordValue = toSignal(this.registerForm.controls.password.valueChanges, {
    initialValue: this.registerForm.controls.password.value,
  });

  readonly passwordStrength = computed(() => {
    const pass: string = this.passwordValue() ?? '';
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 10) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/[0-9]/.test(pass) && /[^A-Za-z0-9]/.test(pass)) score++;
    return Math.min(score, 4);
  });

  readonly passwordStrengthColor = computed(() => {
    const s = this.passwordStrength();
    if (s <= 1) return '#ef4444';
    if (s === 2) return '#f97316';
    if (s === 3) return '#eab308';
    return '#22c55e';
  });

  readonly passwordStrengthLabel = computed(() => {
    const s = this.passwordStrength();
    if (s <= 1) return 'Débil';
    if (s === 2) return 'Regular';
    if (s === 3) return 'Buena';
    return 'Muy fuerte';
  });

  /* ─────────────────────────── lifecycle ─────────────────────────── */

  ngOnInit(): void {
    this.buildCarouselSlides();

    const redirect = this.route.snapshot.queryParamMap.get('redirect');
    if (redirect) this.redirectUrl = redirect;

    if (this.isBrowser) {
      const rememberedEmail = this.auth.getRememberedEmail();
      if (rememberedEmail) {
        this.loginForm.patchValue({ email: rememberedEmail, remember: true });
      }
      this.slideInterval = setInterval(() => this.nextSlide(), 5000);
      this.startCarouselAutoPlay();
    }
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      this.initNeuralCanvas();
    }
  }

  ngOnDestroy(): void {
    if (this.slideInterval) clearInterval(this.slideInterval);
    if (this.carouselInterval) clearInterval(this.carouselInterval);
    if (this.animationFrameId !== undefined) cancelAnimationFrame(this.animationFrameId);
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
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

  /* ─────────────────────────── carrusel ─────────────────────────── */

  private buildCarouselSlides(): void {
    const raw = [
      {
        id: 1,
        badge: 'Dashboard IA',
        badgeBg: 'rgba(6,182,212,0.15)',
        badgeColor: '#22d3ee',
        badgeBorder: 'rgba(6,182,212,0.4)',
        category: 'Análisis en tiempo real',
        accentColor: '#22d3ee',
        title: 'Dashboard Financiero Inteligente',
        description: 'Visualiza todas tus métricas en un solo lugar con gráficos impulsados por IA.',
        svgRaw: this.buildDashboardSVG(),
      },
      {
        id: 2,
        badge: 'Predicción IA',
        badgeBg: 'rgba(168,85,247,0.15)',
        badgeColor: '#c084fc',
        badgeBorder: 'rgba(168,85,247,0.4)',
        category: 'Flujo de caja predictivo',
        accentColor: '#c084fc',
        title: 'Predicción de Ingresos y Egresos',
        description: 'Anticipa tu flujo de caja con modelos de aprendizaje profundo entrenados en tus datos.',
        svgRaw: this.buildPredictionSVG(),
      },
      {
        id: 3,
        badge: 'Seguridad 256-bit',
        badgeBg: 'rgba(16,185,129,0.15)',
        badgeColor: '#34d399',
        badgeBorder: 'rgba(16,185,129,0.4)',
        category: 'Protección bancaria',
        accentColor: '#34d399',
        title: 'Seguridad de Nivel Militar',
        description: 'Encriptación AES-256 y autenticación multifactor para proteger cada transacción.',
        svgRaw: this.buildSecuritySVG(),
      },
      {
        id: 4,
        badge: 'Facturación',
        badgeBg: 'rgba(251,191,36,0.15)',
        badgeColor: '#fbbf24',
        badgeBorder: 'rgba(251,191,36,0.4)',
        category: 'Automatización contable',
        accentColor: '#fbbf24',
        title: 'Facturación Electrónica Automática',
        description: 'Genera y envía facturas electrónicas en segundos con validación fiscal automática.',
        svgRaw: this.buildBillingSVG(),
      },
    ];

    this.carouselSlides = raw.map((s) => ({
      ...s,
      svgScene: this.sanitizer.bypassSecurityTrustHtml(s.svgRaw),
    }));
  }

  private buildDashboardSVG(): string {
    return `
    <svg width="100%" height="100%" viewBox="0 0 640 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="bg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#060b1a"/>
          <stop offset="100%" stop-color="#0a1628"/>
        </linearGradient>
        <linearGradient id="cyan1" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="#22d3ee" stop-opacity="0.3"/>
        </linearGradient>
        <linearGradient id="purple1" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="#a78bfa" stop-opacity="0.3"/>
        </linearGradient>
        <linearGradient id="blue1" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="#2563eb" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="#60a5fa" stop-opacity="0.3"/>
        </linearGradient>
        <linearGradient id="green1" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="#059669" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="#34d399" stop-opacity="0.3"/>
        </linearGradient>
        <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#06b6d4"/>
          <stop offset="50%" stop-color="#3b82f6"/>
          <stop offset="100%" stop-color="#8b5cf6"/>
        </linearGradient>
        <filter id="glow1">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <!-- Fondo -->
      <rect width="640" height="400" fill="url(#bg1)"/>

      <!-- Grid lines -->
      <g stroke="rgba(6,182,212,0.06)" stroke-width="1">
        <line x1="0" y1="80" x2="640" y2="80"/>
        <line x1="0" y1="160" x2="640" y2="160"/>
        <line x1="0" y1="240" x2="640" y2="240"/>
        <line x1="0" y1="320" x2="640" y2="320"/>
        <line x1="107" y1="0" x2="107" y2="400"/>
        <line x1="214" y1="0" x2="214" y2="400"/>
        <line x1="321" y1="0" x2="321" y2="400"/>
        <line x1="428" y1="0" x2="428" y2="400"/>
        <line x1="535" y1="0" x2="535" y2="400"/>
      </g>

      <!-- Orbes de luz -->
      <circle cx="320" cy="180" r="200" fill="rgba(6,182,212,0.04)"/>
      <circle cx="500" cy="100" r="120" fill="rgba(139,92,246,0.05)"/>

      <!-- Barras del gráfico principal -->
      <rect x="80"  y="260" width="45" height="80" rx="6" fill="url(#cyan1)"/>
      <rect x="145" y="200" width="45" height="140" rx="6" fill="url(#purple1)"/>
      <rect x="210" y="180" width="45" height="160" rx="6" fill="url(#blue1)"/>
      <rect x="275" y="140" width="45" height="200" rx="6" fill="url(#cyan1)"/>
      <rect x="340" y="160" width="45" height="180" rx="6" fill="url(#purple1)"/>
      <rect x="405" y="120" width="45" height="220" rx="6" fill="url(#green1)"/>
      <rect x="470" y="100" width="45" height="240" rx="6" fill="url(#cyan1)"/>
      <rect x="535" y="130" width="45" height="210" rx="6" fill="url(#blue1)"/>

      <!-- Línea de tendencia -->
      <polyline
        points="102,270 167,220 232,195 297,160 362,175 427,130 492,110 557,140"
        fill="none"
        stroke="url(#lineGrad)"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        filter="url(#glow1)"
      />

      <!-- Puntos de datos -->
      <circle cx="102" cy="270" r="4" fill="#22d3ee" filter="url(#glow1)"/>
      <circle cx="232" cy="195" r="4" fill="#60a5fa" filter="url(#glow1)"/>
      <circle cx="362" cy="175" r="4" fill="#a78bfa" filter="url(#glow1)"/>
      <circle cx="492" cy="110" r="5" fill="#22d3ee" filter="url(#glow1)"/>
      <circle cx="557" cy="140" r="4" fill="#60a5fa" filter="url(#glow1)"/>

      <!-- Tooltip flotante -->
      <rect x="460" y="60" width="130" height="52" rx="10" fill="rgba(15,23,42,0.95)" stroke="rgba(6,182,212,0.4)" stroke-width="1"/>
      <text x="473" y="82" font-family="monospace" font-size="10" fill="#94a3b8">INGRESOS</text>
      <text x="473" y="100" font-family="monospace" font-size="14" font-weight="bold" fill="#22d3ee">$24,850.00</text>
      <circle cx="584" cy="75" r="3" fill="#22d3ee"/>
      <text x="473" y="113" font-family="monospace" font-size="9" fill="#34d399">▲ +12.4%</text>

      <!-- Mini KPI cards superiores -->
      <rect x="20" y="14" width="140" height="40" rx="8" fill="rgba(15,23,42,0.8)" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      <text x="32" y="30" font-family="monospace" font-size="9" fill="#64748b">BALANCE</text>
      <text x="32" y="46" font-family="monospace" font-size="13" font-weight="bold" fill="#f8fafc">$142,300</text>

      <rect x="175" y="14" width="130" height="40" rx="8" fill="rgba(15,23,42,0.8)" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      <text x="187" y="30" font-family="monospace" font-size="9" fill="#64748b">GASTOS HOY</text>
      <text x="187" y="46" font-family="monospace" font-size="13" font-weight="bold" fill="#f43f5e">-$3,240</text>

      <rect x="320" y="14" width="130" height="40" rx="8" fill="rgba(15,23,42,0.8)" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      <text x="332" y="30" font-family="monospace" font-size="9" fill="#64748b">META AHORRO</text>
      <text x="332" y="46" font-family="monospace" font-size="13" font-weight="bold" fill="#34d399">78%</text>
    </svg>`;
  }

  private buildPredictionSVG(): string {
    return `
    <svg width="100%" height="100%" viewBox="0 0 640 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="bg2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#080612"/>
          <stop offset="100%" stop-color="#0f0a20"/>
        </linearGradient>
        <linearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="predictGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#c084fc" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="#c084fc" stop-opacity="0"/>
        </linearGradient>
        <filter id="glow2">
          <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <rect width="640" height="400" fill="url(#bg2)"/>

      <!-- Grid -->
      <g stroke="rgba(139,92,246,0.07)" stroke-width="1">
        <line x1="0" y1="100" x2="640" y2="100"/>
        <line x1="0" y1="180" x2="640" y2="180"/>
        <line x1="0" y1="260" x2="640" y2="260"/>
        <line x1="0" y1="340" x2="640" y2="340"/>
      </g>

      <!-- Orbe morado de fondo -->
      <circle cx="320" cy="200" r="220" fill="rgba(139,92,246,0.04)"/>
      <circle cx="550" cy="80" r="100" fill="rgba(192,132,252,0.06)"/>

      <!-- Área rellena histórica -->
      <path
        d="M60,290 C100,270 130,240 180,210 C220,185 260,200 300,170 C330,148 360,155 400,135 L400,360 L60,360 Z"
        fill="url(#areaGrad)"
      />

      <!-- Línea histórica sólida -->
      <polyline
        points="60,290 100,268 140,242 180,210 220,224 260,198 300,170 340,160 400,135"
        fill="none"
        stroke="#8b5cf6"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        filter="url(#glow2)"
      />

      <!-- Línea predicción (punteada) -->
      <polyline
        points="400,135 450,115 490,108 540,95 590,88"
        fill="none"
        stroke="#c084fc"
        stroke-width="2"
        stroke-dasharray="6,4"
        stroke-linecap="round"
        filter="url(#glow2)"
      />

      <!-- Área predicción -->
      <path
        d="M400,135 C430,118 460,110 490,108 C520,105 555,98 590,88 L590,200 C555,210 520,220 490,225 C460,228 430,232 400,240 Z"
        fill="url(#predictGrad)"
      />

      <!-- Separador "HOY" -->
      <line x1="400" y1="60" x2="400" y2="360" stroke="rgba(192,132,252,0.4)" stroke-width="1.5" stroke-dasharray="4,3"/>
      <rect x="385" y="60" width="30" height="18" rx="5" fill="rgba(139,92,246,0.3)" stroke="rgba(192,132,252,0.5)" stroke-width="1"/>
      <text x="400" y="73" font-family="monospace" font-size="8" fill="#c084fc" text-anchor="middle">HOY</text>

      <!-- Puntos clave -->
      <circle cx="60"  cy="290" r="4" fill="#8b5cf6" filter="url(#glow2)"/>
      <circle cx="180" cy="210" r="4" fill="#8b5cf6" filter="url(#glow2)"/>
      <circle cx="300" cy="170" r="4" fill="#8b5cf6" filter="url(#glow2)"/>
      <circle cx="400" cy="135" r="6" fill="#c084fc" stroke="#f8fafc" stroke-width="1.5" filter="url(#glow2)"/>
      <circle cx="540" cy="95"  r="4" fill="#c084fc" filter="url(#glow2)" opacity="0.7"/>
      <circle cx="590" cy="88"  r="4" fill="#c084fc" filter="url(#glow2)" opacity="0.7"/>

      <!-- Tooltip predicción -->
      <rect x="480" y="50" width="148" height="62" rx="10" fill="rgba(15,10,30,0.95)" stroke="rgba(192,132,252,0.4)" stroke-width="1"/>
      <text x="494" y="70" font-family="monospace" font-size="9" fill="#94a3b8">PREDICCIÓN 30 DÍAS</text>
      <text x="494" y="88" font-family="monospace" font-size="14" font-weight="bold" fill="#c084fc">$31,200.00</text>
      <text x="494" y="104" font-family="monospace" font-size="9" fill="#34d399">▲ Confianza: 94.2%</text>

      <!-- Etiquetas meses -->
      <text x="60"  y="378" font-family="monospace" font-size="9" fill="#475569" text-anchor="middle">ENE</text>
      <text x="140" y="378" font-family="monospace" font-size="9" fill="#475569" text-anchor="middle">FEB</text>
      <text x="220" y="378" font-family="monospace" font-size="9" fill="#475569" text-anchor="middle">MAR</text>
      <text x="300" y="378" font-family="monospace" font-size="9" fill="#475569" text-anchor="middle">ABR</text>
      <text x="400" y="378" font-family="monospace" font-size="9" fill="#c084fc" text-anchor="middle">HOY</text>
      <text x="490" y="378" font-family="monospace" font-size="9" fill="#64748b" text-anchor="middle">JUN ›</text>
      <text x="580" y="378" font-family="monospace" font-size="9" fill="#64748b" text-anchor="middle">JUL ›</text>

      <!-- Badge IA en esquina -->
      <rect x="20" y="18" width="110" height="32" rx="8" fill="rgba(139,92,246,0.2)" stroke="rgba(192,132,252,0.3)" stroke-width="1"/>
      <circle cx="35" cy="34" r="4" fill="#a78bfa"/>
      <text x="45" y="38" font-family="monospace" font-size="10" fill="#c084fc">IA Predictiva</text>
    </svg>`;
  }

  private buildSecuritySVG(): string {
    return `
    <svg width="100%" height="100%" viewBox="0 0 640 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="bg3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#030f0a"/>
          <stop offset="100%" stop-color="#071a12"/>
        </linearGradient>
        <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#059669"/>
          <stop offset="100%" stop-color="#10b981"/>
        </linearGradient>
        <filter id="glow3">
          <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="glow3soft">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <radialGradient id="emeraldGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="#10b981" stop-opacity="0"/>
        </radialGradient>
      </defs>

      <rect width="640" height="400" fill="url(#bg3)"/>

      <!-- Círculos de radar -->
      <circle cx="320" cy="195" r="160" fill="none" stroke="rgba(16,185,129,0.08)" stroke-width="1"/>
      <circle cx="320" cy="195" r="120" fill="none" stroke="rgba(16,185,129,0.10)" stroke-width="1"/>
      <circle cx="320" cy="195" r="80"  fill="none" stroke="rgba(16,185,129,0.14)" stroke-width="1.5"/>
      <circle cx="320" cy="195" r="40"  fill="none" stroke="rgba(16,185,129,0.20)" stroke-width="1.5"/>
      <circle cx="320" cy="195" r="180" fill="url(#emeraldGlow)"/>

      <!-- Líneas de radar -->
      <line x1="320" y1="35"  x2="320" y2="355" stroke="rgba(16,185,129,0.07)" stroke-width="1"/>
      <line x1="160" y1="195" x2="480" y2="195" stroke="rgba(16,185,129,0.07)" stroke-width="1"/>
      <line x1="207" y1="82"  x2="433" y2="308" stroke="rgba(16,185,129,0.05)" stroke-width="1"/>
      <line x1="433" y1="82"  x2="207" y2="308" stroke="rgba(16,185,129,0.05)" stroke-width="1"/>

      <!-- Escudo principal -->
      <path
        d="M320,90 L370,115 L370,175 C370,210 348,238 320,250 C292,238 270,210 270,175 L270,115 Z"
        fill="rgba(5,150,105,0.15)"
        stroke="url(#shieldGrad)"
        stroke-width="2.5"
        filter="url(#glow3)"
      />

      <!-- Check interior -->
      <polyline
        points="300,175 315,190 345,158"
        fill="none"
        stroke="#34d399"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        filter="url(#glow3)"
      />

      <!-- Nodos de amenazas bloqueadas -->
      <circle cx="160" cy="120" r="18" fill="rgba(239,68,68,0.15)" stroke="rgba(239,68,68,0.5)" stroke-width="1.5" filter="url(#glow3soft)"/>
      <text x="160" y="125" font-family="monospace" font-size="12" fill="#ef4444" text-anchor="middle">✕</text>
      <line x1="178" y1="130" x2="270" y2="155" stroke="rgba(239,68,68,0.3)" stroke-width="1" stroke-dasharray="4,3"/>

      <circle cx="500" cy="110" r="18" fill="rgba(239,68,68,0.15)" stroke="rgba(239,68,68,0.5)" stroke-width="1.5" filter="url(#glow3soft)"/>
      <text x="500" y="115" font-family="monospace" font-size="12" fill="#ef4444" text-anchor="middle">✕</text>
      <line x1="484" y1="120" x2="370" y2="148" stroke="rgba(239,68,68,0.3)" stroke-width="1" stroke-dasharray="4,3"/>

      <circle cx="140" cy="290" r="18" fill="rgba(239,68,68,0.15)" stroke="rgba(239,68,68,0.5)" stroke-width="1.5" filter="url(#glow3soft)"/>
      <text x="140" y="295" font-family="monospace" font-size="12" fill="#ef4444" text-anchor="middle">✕</text>
      <line x1="157" y1="280" x2="270" y2="220" stroke="rgba(239,68,68,0.3)" stroke-width="1" stroke-dasharray="4,3"/>

      <circle cx="505" cy="280" r="18" fill="rgba(239,68,68,0.15)" stroke="rgba(239,68,68,0.5)" stroke-width="1.5" filter="url(#glow3soft)"/>
      <text x="505" y="285" font-family="monospace" font-size="12" fill="#ef4444" text-anchor="middle">✕</text>
      <line x1="490" y1="270" x2="370" y2="215" stroke="rgba(239,68,68,0.3)" stroke-width="1" stroke-dasharray="4,3"/>

      <!-- Panel inferior de stats -->
      <rect x="50" y="340" width="160" height="44" rx="10" fill="rgba(5,150,105,0.1)" stroke="rgba(16,185,129,0.25)" stroke-width="1"/>
      <text x="130" y="358" font-family="monospace" font-size="9" fill="#64748b" text-anchor="middle">AMENAZAS BLOQUEADAS</text>
      <text x="130" y="376" font-family="monospace" font-size="16" font-weight="bold" fill="#34d399" text-anchor="middle">1,284</text>

      <rect x="240" y="340" width="160" height="44" rx="10" fill="rgba(6,182,212,0.1)" stroke="rgba(6,182,212,0.25)" stroke-width="1"/>
      <text x="320" y="358" font-family="monospace" font-size="9" fill="#64748b" text-anchor="middle">UPTIME SEGURIDAD</text>
      <text x="320" y="376" font-family="monospace" font-size="16" font-weight="bold" fill="#22d3ee" text-anchor="middle">99.99%</text>

      <rect x="430" y="340" width="160" height="44" rx="10" fill="rgba(168,85,247,0.1)" stroke="rgba(168,85,247,0.25)" stroke-width="1"/>
      <text x="510" y="358" font-family="monospace" font-size="9" fill="#64748b" text-anchor="middle">CIFRADO AES</text>
      <text x="510" y="376" font-family="monospace" font-size="16" font-weight="bold" fill="#a78bfa" text-anchor="middle">256-bit</text>
    </svg>`;
  }

  private buildBillingSVG(): string {
    return `
    <svg width="100%" height="100%" viewBox="0 0 640 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="bg4" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0a0800"/>
          <stop offset="100%" stop-color="#130f00"/>
        </linearGradient>
        <linearGradient id="invoiceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
        <linearGradient id="stampGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#059669"/>
          <stop offset="100%" stop-color="#10b981"/>
        </linearGradient>
        <filter id="glow4">
          <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="shadow4">
          <feDropShadow dx="4" dy="8" stdDeviation="12" flood-color="rgba(0,0,0,0.6)"/>
        </filter>
      </defs>

      <rect width="640" height="400" fill="url(#bg4)"/>

      <!-- Orbe dorado -->
      <circle cx="350" cy="200" r="200" fill="rgba(251,191,36,0.04)"/>
      <circle cx="550" cy="80"  r="100" fill="rgba(251,191,36,0.05)"/>

      <!-- Factura principal (fondo inclinado) -->
      <rect x="180" y="55" width="280" height="290" rx="14"
            fill="rgba(15,23,42,0.6)"
            stroke="rgba(251,191,36,0.15)"
            stroke-width="1.5"
            transform="rotate(-3 320 200)"
            filter="url(#shadow4)"/>

      <!-- Factura frontal -->
      <rect x="170" y="48" width="300" height="300" rx="14"
            fill="url(#invoiceGrad)"
            stroke="rgba(251,191,36,0.3)"
            stroke-width="1.5"
            filter="url(#shadow4)"/>

      <!-- Header factura -->
      <rect x="170" y="48" width="300" height="55" rx="14" fill="rgba(251,191,36,0.12)"/>
      <rect x="170" y="88" width="300" height="15" rx="0" fill="rgba(251,191,36,0.12)"/>

      <text x="187" y="72" font-family="monospace" font-size="11" font-weight="bold" fill="#fbbf24">FACTURA ELECTRÓNICA</text>
      <text x="187" y="89" font-family="monospace" font-size="8" fill="#94a3b8">FE-2026-00847  ·  RFC: XAXX010101000</text>

      <!-- Líneas de concepto -->
      <line x1="187" y1="116" x2="453" y2="116" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
      <text x="187" y="132" font-family="monospace" font-size="8" fill="#64748b">CONCEPTO</text>
      <text x="400" y="132" font-family="monospace" font-size="8" fill="#64748b" text-anchor="end">TOTAL</text>

      <text x="187" y="150" font-family="monospace" font-size="9" fill="#e2e8f0">Servicio de consultoría IA</text>
      <text x="453" y="150" font-family="monospace" font-size="9" fill="#f8fafc" text-anchor="end">$12,500.00</text>

      <line x1="187" y1="158" x2="453" y2="158" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>

      <text x="187" y="175" font-family="monospace" font-size="9" fill="#e2e8f0">Licencia plataforma — 12 meses</text>
      <text x="453" y="175" font-family="monospace" font-size="9" fill="#f8fafc" text-anchor="end">$8,400.00</text>

      <line x1="187" y1="183" x2="453" y2="183" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>

      <text x="187" y="200" font-family="monospace" font-size="9" fill="#e2e8f0">Soporte premium 24/7</text>
      <text x="453" y="200" font-family="monospace" font-size="9" fill="#f8fafc" text-anchor="end">$3,600.00</text>

      <!-- Subtotal / IVA / Total -->
      <line x1="187" y1="215" x2="453" y2="215" stroke="rgba(251,191,36,0.2)" stroke-width="1"/>
      <text x="187" y="230" font-family="monospace" font-size="8" fill="#64748b">Subtotal</text>
      <text x="453" y="230" font-family="monospace" font-size="8" fill="#94a3b8" text-anchor="end">$24,500.00</text>

      <text x="187" y="245" font-family="monospace" font-size="8" fill="#64748b">IVA 16%</text>
      <text x="453" y="245" font-family="monospace" font-size="8" fill="#94a3b8" text-anchor="end">$3,920.00</text>

      <line x1="187" y1="255" x2="453" y2="255" stroke="rgba(251,191,36,0.3)" stroke-width="1.5"/>

      <text x="187" y="275" font-family="monospace" font-size="11" font-weight="bold" fill="#fbbf24">TOTAL A PAGAR</text>
      <text x="453" y="275" font-family="monospace" font-size="14" font-weight="bold" fill="#fbbf24" text-anchor="end">$28,420.00</text>

      <!-- QR placeholder -->
      <rect x="187" y="288" width="52" height="52" rx="6" fill="rgba(251,191,36,0.08)" stroke="rgba(251,191,36,0.3)" stroke-width="1"/>
      <g fill="rgba(251,191,36,0.6)" transform="translate(192,293)">
        <rect x="0"  y="0"  width="5" height="5"/>
        <rect x="7"  y="0"  width="5" height="5"/>
        <rect x="14" y="0"  width="5" height="5"/>
        <rect x="21" y="0"  width="5" height="5"/>
        <rect x="35" y="0"  width="5" height="5"/>
        <rect x="0"  y="7"  width="5" height="5"/>
        <rect x="21" y="7"  width="5" height="5"/>
        <rect x="35" y="7"  width="5" height="5"/>
        <rect x="0"  y="14" width="5" height="5"/>
        <rect x="7"  y="14" width="5" height="5"/>
        <rect x="21" y="14" width="5" height="5"/>
        <rect x="28" y="14" width="5" height="5"/>
        <rect x="0"  y="21" width="5" height="5"/>
        <rect x="14" y="21" width="5" height="5"/>
        <rect x="35" y="21" width="5" height="5"/>
        <rect x="0"  y="35" width="5" height="5"/>
        <rect x="7"  y="35" width="5" height="5"/>
        <rect x="21" y="35" width="5" height="5"/>
      </g>
      <text x="249" y="308" font-family="monospace" font-size="7.5" fill="#64748b">Verifica la autenticidad</text>
      <text x="249" y="319" font-family="monospace" font-size="7.5" fill="#64748b">del CFDi escaneando</text>
      <text x="249" y="330" font-family="monospace" font-size="7.5" fill="#64748b">el código QR.</text>

      <!-- SELLO PAGADO -->
      <circle cx="420" cy="310" r="32" fill="none" stroke="#10b981" stroke-width="3" filter="url(#glow4)" opacity="0.9" transform="rotate(-15 420 310)"/>
      <text x="420" y="306" font-family="monospace" font-size="10" font-weight="bold" fill="#34d399" text-anchor="middle" transform="rotate(-15 420 310)">PAGADO</text>
      <text x="420" y="320" font-family="monospace" font-size="7" fill="#34d399" text-anchor="middle" transform="rotate(-15 420 310)">2026-08-04</text>

      <!-- Indicador SAT -->
      <rect x="20" y="18" width="140" height="30" rx="8" fill="rgba(251,191,36,0.1)" stroke="rgba(251,191,36,0.3)" stroke-width="1"/>
      <text x="90" y="38" font-family="monospace" font-size="9" fill="#fbbf24" text-anchor="middle">✓ Validado por el SAT</text>

      <!-- Partículas doradas -->
      <circle cx="560" cy="150" r="3" fill="rgba(251,191,36,0.6)" filter="url(#glow4)"/>
      <circle cx="590" cy="230" r="2" fill="rgba(251,191,36,0.4)" filter="url(#glow4)"/>
      <circle cx="100" cy="180" r="2" fill="rgba(251,191,36,0.4)" filter="url(#glow4)"/>
      <circle cx="80"  cy="280" r="3" fill="rgba(251,191,36,0.3)" filter="url(#glow4)"/>
      <circle cx="590" cy="320" r="2" fill="rgba(251,191,36,0.5)" filter="url(#glow4)"/>
    </svg>`;
  }

  /* ── Controles del carrusel ── */

  private startCarouselAutoPlay(): void {
    this.carouselInterval = setInterval(() => {
      if (!this.carouselPaused()) {
        this.nextCarousel();
      }
    }, 5000);
  }

  nextCarousel(): void {
    this.activeCarousel.set((this.activeCarousel() + 1) % this.carouselSlides.length);
  }

  prevCarousel(): void {
    this.activeCarousel.set(
      (this.activeCarousel() - 1 + this.carouselSlides.length) % this.carouselSlides.length,
    );
  }

  goToCarousel(index: number): void {
    this.activeCarousel.set(index);
  }

  pauseCarousel(): void {
    this.carouselPaused.set(true);
  }

  resumeCarousel(): void {
    this.carouselPaused.set(false);
  }

  /* ── Feature slides ── */

  setMode(mode: AuthMode): void {
    this.mode.set(mode);
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  goToSlide(index: number): void {
    this.activeSlide.set(index);
  }

  private nextSlide(): void {
    this.activeSlide.set((this.activeSlide() + 1) % this.slides.length);
  }

  /* ── Formulario ── */

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword.update((v) => !v);
  }

  toggleForgotHint(): void {
    this.showForgotHint.update((v) => !v);
  }

  /* ── Flujo de Recuperación de Contraseña ── */
  startForgotPassword(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.mode.set('forgot');
    this.forgotStep.set(1);
    this.forgotEmail.set(this.loginForm.controls.email.value || 'demo@fintech.ai');
    this.forgotCode.set('');
    this.forgotNewPassword.set('');
    this.forgotConfirmPassword.set('');
  }

  async submitForgotStep1(e?: Event): Promise<void> {
    if (e) e.preventDefault();
    this.errorMessage.set(null);
    let email = this.forgotEmail().trim();
    if (!email) {
      email = 'demo@fintech.ai';
      this.forgotEmail.set(email);
    }

    this.loading.set(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    this.loading.set(false);

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.generatedCode.set(code);
    this.forgotStep.set(2);

    // Imprimir código en la consola / terminal del desarrollador
    console.log('%c[FINTECH AI - SERVICIO DE SEGURIDAD]', 'color: #22d3ee; font-weight: bold; font-size: 14px;');
    console.log(`%c📧 CÓDIGO ENVIADO A: ${email}`, 'color: #a855f7; font-weight: bold;');
    console.log(`%c🔑 CÓDIGO DE VERIFICACIÓN: ${code}`, 'color: #34d399; font-weight: bold; font-size: 18px; background: #070a13; padding: 6px 12px; border: 1px solid #06b6d4; border-radius: 6px;');

    this.showToast(`📧 Código enviado a ${email} (Ver consola/terminal: ${code})`);
  }

  autofillForgotCode(): void {
    this.forgotCode.set(this.generatedCode());
  }

  async submitForgotStep2(e?: Event): Promise<void> {
    if (e) e.preventDefault();
    this.errorMessage.set(null);
    let entered = this.forgotCode().trim();
    if (!entered) {
      entered = this.generatedCode();
      this.forgotCode.set(entered);
    }

    this.loading.set(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    this.loading.set(false);

    this.forgotStep.set(3);
    this.showToast('✅ Código verificado exitosamente. Ingresa tu nueva contraseña.');
  }

  async submitForgotStep3(e?: Event): Promise<void> {
    if (e) e.preventDefault();
    this.errorMessage.set(null);
    let pass = this.forgotNewPassword();
    let confirm = this.forgotConfirmPassword();

    if (!pass) {
      pass = 'NuevaClave123';
      confirm = 'NuevaClave123';
      this.forgotNewPassword.set(pass);
      this.forgotConfirmPassword.set(confirm);
    }

    if (pass.length < 6) {
      this.errorMessage.set('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (pass !== confirm) {
      this.errorMessage.set('Las contraseñas no coinciden.');
      return;
    }

    this.loading.set(true);
    const result = await this.auth.resetPassword(this.forgotEmail(), pass);
    this.loading.set(false);

    if (!result.success) {
      this.errorMessage.set(result.message ?? 'Error al actualizar contraseña.');
      return;
    }

    this.mode.set('login');
    this.loginForm.patchValue({ email: this.forgotEmail(), password: pass });
    this.successMessage.set('¡Contraseña restablecida exitosamente! Ya puedes iniciar sesión con tu nueva clave.');
  }

  resendForgotCode(): void {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.generatedCode.set(code);

    console.log('%c[FINTECH AI - REENVÍO DE CÓDIGO]', 'color: #22d3ee; font-weight: bold; font-size: 14px;');
    console.log(`%c🔑 NUEVO CÓDIGO REENVIADO: ${code}`, 'color: #fbbf24; font-weight: bold; font-size: 18px; background: #070a13; padding: 6px 12px; border: 1px solid #a855f7; border-radius: 6px;');

    this.showToast(`📧 Nuevo código reenviado (Ver consola/terminal: ${code})`);
  }

  async onSubmitLogin(): Promise<void> {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { email, password, remember } = this.loginForm.getRawValue();
    this.loading.set(true);

    const result = await this.auth.login(email!, password!, !!remember);
    this.loading.set(false);

    if (!result.success) {
      this.errorMessage.set(result.message ?? 'No se pudo iniciar sesión.');
      return;
    }

    this.successMessage.set('¡Bienvenido de nuevo! Redirigiendo...');
    setTimeout(() => this.router.navigateByUrl(this.redirectUrl), 700);
  }

  async onSubmitRegister(): Promise<void> {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      if (this.registerForm.errors?.['passwordMismatch']) {
        this.errorMessage.set('Las contraseñas no coinciden.');
      }
      return;
    }

    const { name, email, password } = this.registerForm.getRawValue();
    this.loading.set(true);

    const result = await this.auth.register(name!, email!, password!);
    this.loading.set(false);

    if (!result.success) {
      this.errorMessage.set(result.message ?? 'No se pudo crear la cuenta.');
      return;
    }

    this.successMessage.set('¡Cuenta creada! Redirigiendo al dashboard...');
    setTimeout(() => this.router.navigateByUrl(this.redirectUrl), 700);
  }

  fillDemoCredentials(): void {
    this.setMode('login');
    this.loginForm.patchValue({ email: 'demo@fintech.ai', password: 'Demo1234', remember: true });
  }

  continueWithProvider(provider: SocialProvider): void {
    this.showToast(`El inicio de sesión con ${provider} no está disponible en esta demo.`);
  }

  private showToast(message: string): void {
    this.toastMessage.set(message);
    setTimeout(() => {
      if (this.toastMessage() === message) this.toastMessage.set(null);
    }, 3200);
  }
}
