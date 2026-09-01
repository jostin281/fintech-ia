# Automatización: descargar comprobantes del SRI e importarlos a la app

Este script corre **en tu propia computadora** (no en la nube) y hace dos cosas:

1. Inicia sesión en SRI en Línea con tus credenciales del SRI y descarga los XML de tus comprobantes electrónicos recibidos.
2. Inicia sesión en tu app FinTech (con tu correo/contraseña de la app) y sube esos XML al endpoint de importación de "Comprobantes Recibidos", donde quedan categorizados con su desglose automáticamente — lo mismo que hace el botón "Importar" de esa pantalla, pero sin que tengas que hacerlo a mano.

## 🖱️ Forma más fácil: panel con botones (recomendado)

En vez de escribir comandos en una terminal, puedes usar un panel con botones:

1. Haz doble clic en **`panel.bat`** (en esta misma carpeta, `C:\fintech\automatizacion-sri`).
2. Se abre una ventana con tres pasos:
   - **Configurar credenciales…** — abre `credenciales.env` en el Bloc de notas para que pongas tu usuario y clave del SRI (y tu correo/contraseña de la app).
   - **📥 Descargar ahora** — corre la descarga una sola vez, en ese momento, y muestra el progreso en pantalla. Por defecto trae los comprobantes del día anterior a hoy, pero al lado hay un **calendario** para elegir cualquier otro día en vez de ayer.
   - **Activar / Desactivar descarga automática** — registra o quita la tarea en el Programador de Tareas de Windows para que corra sola todos los días a la hora que elijas (Windows te va a pedir permiso de Administrador la primera vez: es normal, acéptalo). La descarga automática diaria siempre trae el día anterior — el calendario es solo para las descargas manuales.

El panel necesita Python instalado (ver el paso 1 más abajo) pero no requiere que sepas usar la terminal. Los pasos 1 a 4 de este documento explican lo mismo por línea de comandos, para quien lo prefiera o para diagnosticar un problema.

## ⚠️ Aviso importante sobre el paso 1 (SRI)

El código que navega dentro del portal del SRI se escribió **sin poder probarlo contra el sitio real** (el entorno donde se escribió no tiene acceso a internet hacia ese dominio). Es my probable que necesite un ajuste la primera vez que lo corras. Por eso: **la primera vez, ejecútalo con `--debug`** (ver abajo) para verlo paso a paso con el navegador visible, y si algo falla, cuéntame exactamente en qué paso se detiene (una captura de pantalla ayuda mucho) para corregir el selector correcto.

El paso 2 (conexión con tu propia app) sí está verificado contra tu código real y no debería necesitar cambios.

## 1. Instalar requisitos (una sola vez)

Necesitas [Python 3.10 o superior](https://www.python.org/downloads/) instalado en Windows.

Abre una terminal (PowerShell) en esta carpeta (`C:\fintech\automatizacion-sri`) y corre:

```
pip install -r requirements.txt
playwright install chromium
```

(`requirements.txt` incluye `tkcalendar`, que le da al panel un calendario visual para elegir el día a descargar. Si por algo no se instala, el panel sigue funcionando igual pero con un campo de texto DD/MM/AAAA en vez de calendario.)

## 2. Configurar tus credenciales (una sola vez)

1. Copia el archivo `credenciales.env.example` y renómbralo a `credenciales.env` (en la misma carpeta) — o usa el botón "Configurar credenciales…" del panel (`panel.bat`), que hace esta copia por ti.
2. Ábrelo con el Bloc de notas y completa tus datos reales:
   - `SRI_USUARIO` / `SRI_CLAVE`: tus credenciales de https://srienlinea.sri.gob.ec
   - `APP_CORREO` / `APP_CONTRASENA`: tu correo y contraseña de la app FinTech (no del SRI)
3. Guarda el archivo. **Nunca compartas este archivo ni lo subas a git** — ya está excluido en `.gitignore`.

## 3. Probar manualmente antes de programarlo

Con Docker corriendo (`docker compose up -d`, para que el backend esté disponible en `localhost:3001`), abre PowerShell en esta carpeta y corre:

```
python descargar_comprobantes_sri.py --debug
```

Esto abre un navegador visible y pausa en los pasos clave para que confirmes que cada paso funciona. Revisa el archivo `descargar_comprobantes_sri.log` que se genera en esta carpeta para ver el detalle de cada ejecución.

Cuando funcione bien en modo `--debug`, pruébalo también sin `--debug` (modo normal, sin ventana):

```
python descargar_comprobantes_sri.py
```

(El botón "📥 Descargar ahora" del panel hace exactamente esto — con la casilla "Modo debug" para el equivalente de `--debug`, y el calendario de al lado para el equivalente de `--fecha`.)

Por defecto trae los comprobantes del día anterior a hoy. Para elegir otro día por línea de comandos, usa `--fecha`:

```
python descargar_comprobantes_sri.py --fecha 15/08/2026
```

## 4. Programarlo con el Programador de Tareas de Windows

Una vez que confirmes que corre bien manualmente, regístralo para que se ejecute solo todos los días a la hora que quieras.

**Con el panel (más fácil):** en `panel.bat`, pon la hora que quieras en el campo "Hora todos los días" y presiona "Activar descarga automática". Windows va a pedir permiso de Administrador — acéptalo — y queda registrado.

**Por línea de comandos:** corre esto en PowerShell **como administrador**, reemplazando `06:00` por la hora que prefieras (formato 24 horas):

```
powershell -ExecutionPolicy Bypass -File configurar_tarea_windows.ps1 -Hora 06:00
```

Después de eso, Windows ejecutará el script automáticamente todos los días a esa hora, sin que tengas que hacer nada, siempre que tu computadora esté encendida en ese momento (si está apagada o dormida, esa ejecución simplemente no ocurre — Windows no la "recupera" después, a menos que actives esa opción en el Programador de Tareas).

Para revisar o cambiar la hora más adelante, abre "Programador de tareas" en Windows, busca "FinTech - Descarga Comprobantes SRI" y edítala ahí directamente (o vuelve a correr el comando de arriba con otra hora: reemplaza la tarea existente).

Para eliminarla si ya no la necesitas, usa el botón "Desactivar descarga automática" del panel, o por línea de comandos (también como administrador):

```
powershell -ExecutionPolicy Bypass -File configurar_tarea_windows.ps1 -Quitar
```

## Notas

- Si el backend (Docker) no está corriendo cuando se ejecuta la tarea, el script descarga los XML igual pero avisa en el log que no pudo subirlos, y los deja guardados en `descargas/` — puedes correr el script de nuevo más tarde (o importarlos manualmente desde la pantalla de "Comprobantes Recibidos") sin perder nada.
- El backend ya detecta duplicados por clave de acceso, así que no hay riesgo de que una factura quede importada dos veces aunque el script la vuelva a subir.
- Cada ejecución agrega líneas a `descargar_comprobantes_sri.log` en esta misma carpeta — revísalo (o usa el botón "Abrir log completo" del panel) si quieres confirmar que corrió bien mientras no estabas.
