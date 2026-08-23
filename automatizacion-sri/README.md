# Automatización: descargar comprobantes del SRI e importarlos a la app

Este script corre **en tu propia computadora** (no en la nube) y hace dos cosas:

1. Inicia sesión en SRI en Línea con tus credenciales del SRI y descarga los XML de tus comprobantes electrónicos recibidos.
2. Inicia sesión en tu app FinTech (con tu correo/contraseña de la app) y sube esos XML al endpoint de importación de "Comprobantes Recibidos", donde quedan categorizados con su desglose automáticamente — lo mismo que hace el botón "Importar" de esa pantalla, pero sin que tengas que hacerlo a mano.

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

## 2. Configurar tus credenciales (una sola vez)

1. Copia el archivo `credenciales.env.example` y renómbralo a `credenciales.env` (en la misma carpeta).
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

## 4. Programarlo con el Programador de Tareas de Windows

Una vez que confirmes que corre bien manualmente, regístralo para que se ejecute solo todos los días a la hora que quieras. Reemplaza `06:00` por la hora que prefieras (formato 24 horas):

```
schtasks /create /tn "FinTech - Descargar SRI" /tr "C:\fintech\automatizacion-sri\ejecutar.bat" /sc daily /st 06:00 /f
```

Corre ese comando una sola vez en PowerShell **como administrador**. Después de eso, Windows ejecutará el script automáticamente todos los días a esa hora, sin que tengas que hacer nada, siempre que tu computadora esté encendida en ese momento (si está apagada o dormida, esa ejecución simplemente no ocurre — Windows no la "recupera" después, a menos que actives esa opción en el Programador de Tareas).

Para revisar o cambiar la hora más adelante, abre "Programador de tareas" en Windows, busca "FinTech - Descargar SRI" y edítala ahí directamente.

Para eliminarla si ya no la necesitas:

```
schtasks /delete /tn "FinTech - Descargar SRI" /f
```

## Notas

- Si el backend (Docker) no está corriendo cuando se ejecuta la tarea, el script descarga los XML igual pero avisa en el log que no pudo subirlos, y los deja guardados en `descargas/` — puedes correr el script de nuevo más tarde (o importarlos manualmente desde la pantalla de "Comprobantes Recibidos") sin perder nada.
- El backend ya detecta duplicados por clave de acceso, así que no hay riesgo de que una factura quede importada dos veces aunque el script la vuelva a subir.
- Cada ejecución agrega líneas a `descargar_comprobantes_sri.log` en esta misma carpeta — revísalo si quieres confirmar que corrió bien mientras no estabas.
