# Guía rápida: arrancar FintechAI sin repetir los mismos errores

Esta guía resume los 3 problemas que salieron la última vez que se levantó el proyecto (19-20 ago 2026), su causa real y cómo evitarlos.

## Regla de oro: no mezclar los dos modos de arranque

Este proyecto se puede correr de **dos formas**, pero nunca las dos al mismo tiempo:

- **Modo Docker** (`docker compose up`): levanta Postgres + backend + frontend juntos, cada uno en su contenedor.
- **Modo nativo en Windows**: `npm run start:dev` en `fintech-back/` y `ng serve` (o `npm start`) en `fintech-frond/`, sueltos.

Mezclarlos (por ejemplo, dejar un `ng serve` nativo corriendo de una sesión anterior y luego levantar Docker, o viceversa) fue la causa raíz de **todos** los errores de esta sesión: dos procesos peleando por el mismo puerto, o el navegador cargando pedazos de dos builds distintos a la vez.

**Antes de arrancar, decide un modo y verifica que no quede nada del otro corriendo** (ver checklist abajo).

---

## Checklist antes de levantar el proyecto

En PowerShell, revisa que los puertos clave estén libres (o solo ocupados por lo que vas a usar):

```powershell
netstat -ano | findstr :3001
netstat -ano | findstr :4200
netstat -ano | findstr :5433
```

Si aparece un PID con estado `LISTENING` en `0.0.0.0` o `[::]` (no solo conexiones de cliente en `TIME_WAIT`/`CLOSE_WAIT`/`ESTABLISHED`) y no es el proceso que tú vas a usar, mátalo:

```powershell
taskkill /PID <numero> /F
```

> Tip: en la salida de `netstat`, la fila del **servidor real** es la que tiene el puerto (3001/4200/5433) como dirección **local**. Las filas donde el puerto aparece como dirección **remota** son solo clientes conectados a él (no hace falta matarlas).

---

## Error 1 — `EADDRINUSE: address already in use :::3001`

**Causa:** quedó un proceso viejo de `npm run start:dev` (NestJS) corriendo en segundo plano de una sesión anterior, ocupando el puerto 3001, mientras arrancabas uno nuevo encima.

**Solución:**
```powershell
netstat -ano | findstr :3001
taskkill /PID <PID_que_aparezca> /F
```
Repite hasta que `netstat` no muestre ningún `LISTENING` en :3001, y recién ahí vuelve a correr `npm run start:dev`.

---

## Error 2 — Login/Bienvenida no navegan, consola muestra `NG0203: EnvironmentInjector token injection failed`

**Síntoma:** la pantalla de bienvenida no lleva a login, o el botón "Iniciar sesión" no hace nada (no sale ninguna petición `POST /auth/login` en la pestaña Network). En la consola del navegador aparecen 2 errores rojos `NG0203`.

**Causa:** *no* es un bug de código (se revisó todo `inject()` del proyecto, está bien usado en todos lados). Es un desajuste de build en caliente: el dev server de Angular (`ng serve`, con Vite/esbuild) recompiló mientras la pestaña ya tenía cargada una versión anterior, y el navegador terminó con **dos copias del núcleo de Angular** cargadas a la vez en la misma página (se nota en el Network: el mismo `chunk-XXXX.js` aparece dos veces con hashes `?v=` distintos). Eso rompe el contexto de inyección de dependencias.

**Solución:**
1. Cierra por completo la pestaña del navegador (no solo recargar).
2. En DevTools → Network, marca **"Disable cache"**.
3. Abre una pestaña nueva y entra de nuevo a `http://localhost:4200`.
4. Si insiste, detén `ng serve` (Ctrl+C) y vuélvelo a arrancar. Como último recurso, borra la caché de compilación:
```powershell
cd fintech-frond
rmdir /s /q .angular\cache
```

---

## Error 3 — `PrismaClientKnownRequestError ... code: 'ECONNREFUSED'` al hacer login

**Síntoma:** el login sí llega al backend (se ve en el log `AuthService.iniciarSesion`), pero falla con un error de Prisma al buscar el usuario.

**Causa:** Postgres no está corriendo. Casi siempre es porque **Docker Desktop no está abierto** (`docker ps` da el error `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`).

**Solución:**
1. Abre **Docker Desktop** desde el menú de inicio y espera a que la ballena quede fija (no girando) en la bandeja del sistema.
2. Confirma:
```powershell
docker ps
```
3. Levanta el proyecto:
```powershell
cd C:\fintech
docker compose up -d
```
4. Verifica que los 3 contenedores queden arriba (`fintech-postgres` en estado *healthy*, `fintech-backend` y `fintech-frontend` corriendo):
```powershell
docker compose ps
```

**Nota de configuración (ya está bien, no tocar):** el `.env` de `fintech-back` apunta a `localhost:5433` (para cuando corres el backend nativo en Windows). El `docker-compose.yml` sobreescribe esa variable a `postgres:5432` cuando todo corre dentro de Docker. Postgres expone el puerto **5433** en el host (no 5432) a propósito, para no chocar con otro Postgres que puedas tener instalado en Windows.

---

## Arranque recomendado, paso a paso (modo Docker — el más simple)

```powershell
# 1. Verifica que no haya procesos nativos sueltos en 3001/4200/5433 (ver checklist arriba)
# 2. Abre Docker Desktop y espera a que esté listo
docker ps

# 3. Levanta todo el stack
cd C:\fintech
docker compose up -d

# 4. Verifica estado
docker compose ps

# 5. Abre el navegador en una pestaña NUEVA (no reciclada de una sesión vieja)
#    http://localhost:4200
```

Si en vez de Docker prefieres modo nativo, recuerda arrancar primero Postgres en Docker (`docker compose up -d postgres`) y luego, en dos terminales separadas de Windows: `npm run start:dev` (en `fintech-back/`) y `ng serve`/`npm start` (en `fintech-frond/`) — pero nunca junto con `docker compose up` completo.
