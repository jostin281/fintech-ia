import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';

export const routes: Routes = [
  { path: '', redirectTo: 'bienvenida', pathMatch: 'full' },
  {
    path: 'bienvenida',
    loadComponent: () => import('./pages/bienvenida/bienvenida').then((m) => m.Bienvenida),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
    canActivate: [authGuard],
  },
  {
    path: 'movimientos',
    loadComponent: () => import('./pages/movimientos/movimientos').then((m) => m.Movimientos),
    canActivate: [authGuard],
  },
  {
    path: 'presupuestos',
    loadComponent: () => import('./pages/presupuestos/presupuestos').then((m) => m.Presupuestos),
    canActivate: [authGuard],
  },
  {
    path: 'metas-ahorro',
    loadComponent: () => import('./pages/metas-ahorro/metas-ahorro').then((m) => m.MetasAhorro),
    canActivate: [authGuard],
  },
  {
    path: 'facturacion-electronica',
    loadComponent: () =>
      import('./pages/facturacion-electronica/facturacion-electronica').then(
        (m) => m.FacturacionElectronica,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'impuestos',
    loadComponent: () => import('./pages/impuestos/impuestos').then((m) => m.Impuestos),
    canActivate: [authGuard],
  },
  {
    path: 'reportes',
    loadComponent: () => import('./pages/reportes/reportes').then((m) => m.Reportes),
    canActivate: [authGuard],
  },
  {
    path: 'asistente-ia',
    loadComponent: () => import('./pages/asistente-ia/asistente-ia').then((m) => m.AsistenteIa),
    canActivate: [authGuard],
  },
  {
    path: 'notificaciones',
    loadComponent: () =>
      import('./pages/notificaciones/notificaciones').then((m) => m.Notificaciones),
    canActivate: [authGuard],
  },
  {
    path: 'configuracion',
    loadComponent: () =>
      import('./pages/configuracion/configuracion').then((m) => m.Configuracion),
    canActivate: [authGuard],
  },
  {
    path: 'perfil',
    loadComponent: () => import('./pages/perfil/perfil').then((m) => m.Perfil),
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: 'bienvenida' },
];
