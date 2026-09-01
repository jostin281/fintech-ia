import { RenderMode, ServerRoute } from '@angular/ssr';

// Despliegue como sitio ESTATICO puro (Render "static", sin servidor Node
// corriendo main.server.ts/server.ts). Con RenderMode.Prerender, "ng build"
// intenta pre-renderizar cada ruta en tiempo de build; como en ese momento
// nadie esta autenticado, las rutas protegidas (dashboard, movimientos,
// perfil, etc.) quedaban "congeladas" como una pagina estatica que solo
// redirige a /login, y esa pagina estatica pisa siempre a la app real
// -- incluso para un usuario ya logueado que recarga la pagina. Con
// RenderMode.Client, "ng build" genera un solo index.html "bootstrap"
// (el mismo que index.csr.html) y deja que el Angular Router normal,
// corriendo en el navegador, decida que mostrar segun el login real.
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Client
  }
];
