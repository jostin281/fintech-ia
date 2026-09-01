"""
descargar_comprobantes_sri.py

Automatiza dos pasos, uno detrás del otro:

  1. Inicia sesión en SRI en Línea (https://srienlinea.sri.gob.ec) con tus
     credenciales del SRI y descarga los XML de los comprobantes
     electrónicos recibidos (facturas de compra) disponibles.
  2. Inicia sesión en tu app FinTech local (con tu correo/contraseña de la
     APP, no del SRI) y sube esos XML al endpoint de importación de
     "Comprobantes Recibidos", donde tu backend ya los parsea, categoriza
     y calcula el desglose automáticamente.

NOTA SOBRE LOS SELECTORES DEL PORTAL SRI:
El portal SRI en Línea usa JavaServer Faces (JSF) con IDs dinámicos que
pueden cambiar según la versión del portal. El script intenta múltiples
selectores comunes en orden de prioridad. Si ninguno funciona, ejecuta
con --debug para ver el navegador en vivo e inspeccionar el HTML real.

Uso:
    python descargar_comprobantes_sri.py            # modo normal (sin ventana)
    python descargar_comprobantes_sri.py --debug    # abre el navegador visible
    python descargar_comprobantes_sri.py --solo-subir  # sube XMLs ya descargados sin ir al SRI
"""

import argparse
import os
import shutil
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

import requests
from dotenv import load_dotenv
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

BASE_DIR = Path(__file__).resolve().parent
DESCARGAS_DIR = BASE_DIR / "descargas"
PROCESADOS_DIR = DESCARGAS_DIR / "procesados"
LOG_FILE = BASE_DIR / "descargar_comprobantes_sri.log"

# La URL vieja ("/sri-en-linea/inicio/menu/publico") ya no existe — el portal
# ahora es una SPA Angular y esa ruta da 404. Verificado el 2026-08-31: entrar
# a cualquier ruta que exija sesión (como "contribuyente/perfil") redirige
# automáticamente al login real de Keycloak, que es lo que este script
# necesita (los selectores de abajo SÍ coinciden con ese formulario real).
SRI_LOGIN_URL = "https://srienlinea.sri.gob.ec/sri-en-linea/contribuyente/perfil"
SRI_COMPROBANTES_URL = (
    "https://srienlinea.sri.gob.ec/sri-en-linea/"
    "SriRucInternet/ConsultaRuc/Consultas/consultaRuc"
)

# Múltiples candidatos de URL para comprobantes recibidos (el portal SRI
# cambia sus rutas periódicamente — se prueban en orden hasta encontrar una).
#
# CONFIRMADO EN UNA CUENTA REAL el 2026-08-31: la primera URL de abajo
# ("SriComprobantesElectronicosInternet/...") SÍ funciona después de
# iniciar sesión — se probó dos veces y llegó sin redirigir a login. Va
# primera en la lista para no perder tiempo con las demás.
#
# La URL "tuportal-internet/accederAplicacion.jspa?redireccion=57..." es
# el href real del enlace de menú "Comprobantes electrónicos recibidos"
# (se confirmó que ese enlace existe), pero en la práctica SIEMPRE
# redirige a un login nuevo aunque ya haya sesión iniciada — esa app usa
# su propio cliente OIDC ("app-tuportal-internet") con login=true forzado,
# así que este script no puede usarla directo. Se deja al final de la
# lista por si el SRI cambia ese comportamiento.
SRI_COMPROBANTES_URLS_CANDIDATOS = [
    # Confirmada con una captura real de pantalla (31/08/2026) — esta es la
    # que de verdad muestra el listado de comprobantes recibidos.
    "https://srienlinea.sri.gob.ec/comprobantes-electronicos-internet/pages/consultas/recibidos/comprobantesRecibidos.jsf",
    "https://srienlinea.sri.gob.ec/sri-en-linea/SriComprobantesElectronicosInternet/ConsultaComprobantesRecibidos/Consultas/consultaComprobantesRecibidos",
    "https://srienlinea.sri.gob.ec/comprobantes-electronicos-internet/pages/consultas/recibidosConsultas.jsf",
    "https://srienlinea.sri.gob.ec/facturacion-internet/pages/consultas/recibidosConsultas.jsf",
    "https://srienlinea.sri.gob.ec/tuportal-internet/accederAplicacion.jspa?redireccion=57&idGrupo=55",
]

TEXTO_MENU_COMPROBANTES_RECIBIDOS = "Comprobantes electrónicos recibidos"

API_BASE_URL = "http://localhost:3001/api"

# Selectores del portal SRI en Línea (JSF). Se prueban en orden; el primero
# que encuentre el elemento es el que se usa. Si todos fallan con --debug,
# inspecciona el HTML real y actualiza el primer elemento de cada lista.
# Verificados el 2026-08-28 y de nuevo el 2026-08-31 inspeccionando el DOM
# real de https://srienlinea.sri.gob.ec/sri-en-linea/contribuyente/perfil
# (sin iniciar sesión, para ver el formulario de login). El portal corre el
# login sobre Keycloak/OIDC, NO sobre el portal JSF viejo que asumía la
# primera versión de este script. Estos selectores SÍ coinciden con el
# formulario real (#usuario, #ciAdicional, #password, #kc-login) — si antes
# fallaban era porque SRI_LOGIN_URL apuntaba a una ruta que da 404, no por
# estos selectores. El primero de cada lista es el confirmado; los demás
# quedan de respaldo por si el SRI vuelve a cambiar el portal.
SELECTORES_USUARIO = [
    "#usuario",
    "input[name='usuario']",
    "input[id*='usuario']",
    "input[type='text']:first-of-type",
]

# Campo opcional "C.I. adicional" (para entrar como tercero autorizado
# sobre el RUC de otra persona/empresa). Este script no lo llena: asume
# que entras a tu propia cuenta con tu propio RUC/C.I.
SELECTOR_CI_ADICIONAL = "#ciAdicional"

SELECTORES_CLAVE = [
    "#password",
    "input[name='password']",
    "input[id*='password']",
    "input[type='password']",
]

SELECTORES_BTN_LOGIN = [
    "#kc-login",
    "input[type='submit']",
    "button[type='submit']",
]

# Filtro de fecha del listado de comprobantes recibidos (para traer solo lo
# del día anterior a hoy en cada corrida diaria, no todo el historial cada
# vez). A diferencia de los selectores de login, estos NO se pudieron
# confirmar contra el portal real (hace falta sesión iniciada para verlos).
# Si ninguno coincide, el script simplemente sigue sin filtrar por fecha —
# nunca es motivo para detener la descarga. Ajusta con --debug si hace falta.
SELECTORES_FECHA_DESDE = [
    "#fechaEmisionDesde",
    "#fechaDesde",
    "input[name*='fechaDesde']",
    "input[name*='FechaDesde']",
    "input[id*='fechaDesde']",
    "input[id*='FechaDesde']",
    "input[id*='fechaInicio']",
    "input[id*='FechaInicio']",
]
SELECTORES_FECHA_HASTA = [
    "#fechaEmisionHasta",
    "#fechaHasta",
    "input[name*='fechaHasta']",
    "input[name*='FechaHasta']",
    "input[id*='fechaHasta']",
    "input[id*='FechaHasta']",
    "input[id*='fechaFin']",
    "input[id*='FechaFin']",
]
SELECTORES_BOTON_BUSCAR_FECHA = [
    "button:has-text('Buscar')",
    "button:has-text('Consultar')",
    "input[value*='Buscar']",
    "input[value*='Consultar']",
    "#btnBuscar",
    "#btnConsultar",
]

SELECTORES_XML = [
    "a[title*='XML']",
    "a[title*='xml']",
    "a[href*='.xml']",
    "a[href*='xml']",
    "button[title*='XML']",
    ".btn-descargar-xml",
    "a[id*='xml']",
    "a[id*='XML']",
    "span[title*='XML'] a",
    "td a[onclick*='xml']",
]


def log(mensaje: str) -> None:
    linea = f"[{datetime.now().isoformat(timespec='seconds')}] {mensaje}"
    print(linea)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(linea + "\n")


def parece_pantalla_login(pagina) -> bool:
    """
    True si la página actual parece un formulario de login (de cualquier
    sub-aplicación del SRI, no solo la de Keycloak) en vez del listado de
    comprobantes. Varias URLs "directas" del portal en realidad llevan a
    su propia pantalla de inicio de sesión separada (confirmado con
    pruebas reales) en vez de dar error o redirigir de forma obvia, así
    que no basta con mirar la URL — hay que revisar el contenido.
    """
    try:
        if pagina.query_selector("input[type='password']"):
            return True
    except Exception:
        pass
    try:
        titulo = (pagina.title() or "").lower()
        if "login" in titulo or "iniciar sesión" in titulo or "iniciar sesion" in titulo:
            return True
    except Exception:
        pass
    return False


def pausa_debug(mensaje: str, segundos_si_no_hay_terminal: float = 4.0) -> None:
    """
    En modo --debug, muestra `mensaje` y espera a que el usuario presione
    Enter para seguir viendo el navegador paso a paso — pero SOLO si el
    script tiene una terminal real conectada (cuando corres
    `python descargar_comprobantes_sri.py --debug` a mano en PowerShell).

    Si se lanzó sin terminal (por ejemplo desde el panel, panel_control.py,
    que no tiene consola), no hay forma de escribir un Enter, y pedírselo
    colgaba el proceso con un EOFError. En ese caso, en vez de pedir
    Enter, solo espera unos segundos (para dar tiempo a mirar el
    navegador) y sigue solo.
    """
    log(mensaje)
    hay_terminal = bool(sys.stdin) and sys.stdin.isatty()
    if hay_terminal:
        try:
            input()
        except EOFError:
            pass
    else:
        time.sleep(segundos_si_no_hay_terminal)


def cargar_credenciales() -> dict:
    env_path = BASE_DIR / "credenciales.env"
    if not env_path.exists():
        sys.exit(
            "No encontré credenciales.env. Copia credenciales.env.example a "
            "credenciales.env y completa tus datos antes de ejecutar."
        )
    load_dotenv(env_path)
    requeridas = ["SRI_USUARIO", "SRI_CLAVE", "APP_CORREO", "APP_CONTRASENA"]
    valores = {clave: os.getenv(clave) for clave in requeridas}
    faltantes = [c for c, v in valores.items() if not v]
    if faltantes:
        sys.exit(f"Faltan valores en credenciales.env: {', '.join(faltantes)}")
    # Opcional: campo "C.I. adicional" del login del SRI (login como
    # tercero autorizado). No es obligatorio, se deja vacío si no está.
    valores["SRI_CI_ADICIONAL"] = os.getenv("SRI_CI_ADICIONAL") or ""
    return valores


def encontrar_elemento(pagina, selectores: list[str], descripcion: str, timeout: int = 5000):
    """Intenta cada selector de la lista y retorna el primero que encuentre."""
    for selector in selectores:
        try:
            elemento = pagina.wait_for_selector(selector, timeout=timeout, state="visible")
            if elemento:
                log(f"Selector encontrado para {descripcion}: {selector}")
                return elemento
        except PlaywrightTimeoutError:
            continue
    return None


def fecha_ayer() -> str:
    """Fecha de ayer (respecto a hoy) en formato dd/mm/aaaa, el que suele
    usar el portal del SRI en sus filtros de búsqueda."""
    ayer = datetime.now() - timedelta(days=1)
    return ayer.strftime("%d/%m/%Y")


def encontrar_indice_columna(tabla, nombre_columna: str):
    """
    Busca el índice (0-based) de la columna cuyo encabezado coincide
    exactamente con `nombre_columna` (sin importar mayúsculas/minúsculas)
    dentro de una tabla de resultados del SRI. Confirmado con una captura
    real: la columna de descarga del XML se llama literalmente
    "Documento" (con un ícono, no un enlace de texto "XML").
    """
    try:
        encabezados = tabla.query_selector_all("thead th")
        if not encabezados:
            primera_fila = tabla.query_selector("tr")
            if primera_fila:
                encabezados = primera_fila.query_selector_all("th, td")
        objetivo = nombre_columna.strip().lower()
        for i, celda in enumerate(encabezados):
            texto = (celda.text_content() or "").strip().lower()
            if texto == objetivo:
                return i
    except Exception:
        pass
    return None


def fecha_valida(texto: str) -> bool:
    """True si texto tiene forma dd/mm/aaaa y es una fecha real."""
    try:
        datetime.strptime(texto, "%d/%m/%Y")
        return True
    except ValueError:
        return False


MESES_ES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]


def aplicar_filtro_fecha(pagina, debug: bool, fecha: str) -> bool:
    """
    Filtra el listado de comprobantes recibidos por la fecha indicada
    (formato dd/mm/aaaa) — por defecto el día anterior a hoy, o cualquier
    día elegido con --fecha o el calendario del panel.

    Confirmado con una captura real de la pantalla "Comprobantes
    electrónicos recibidos" del SRI: el filtro NO son dos campos de texto
    "desde/hasta" (esa era una suposición equivocada) — son tres listas
    desplegables bajo "Periodo emisión": año, mes y día. Por eso se
    detectan por las opciones que tienen adentro (por ejemplo, cuál lista
    contiene "2026" como opción), en vez de por un id fijo que nunca se
    pudo confirmar contra el portal real.
    """
    try:
        dia, mes, anio = fecha.split("/")
        dia_num = int(dia)
        mes_num = int(mes)
    except Exception:
        log(f"Fecha '{fecha}' no se pudo interpretar para el filtro — se sigue sin filtrar.")
        return False

    try:
        selects = pagina.query_selector_all("select")
    except Exception as exc:
        log(f"No se pudo inspeccionar los campos de esta pantalla: {exc}")
        return False

    select_anio = select_mes = select_dia = None
    for sel in selects:
        try:
            opciones_val = [
                (o.get_attribute("value") or "").strip().lower()
                for o in sel.query_selector_all("option")
            ]
            opciones_txt = [
                (o.text_content() or "").strip().lower()
                for o in sel.query_selector_all("option")
            ]
        except Exception:
            continue

        if select_anio is None and (anio in opciones_val or anio in opciones_txt):
            select_anio = sel
            continue
        if select_mes is None and (
            any(m in opciones_txt for m in MESES_ES)
            or f"{mes_num:02d}" in opciones_val
            or str(mes_num) in opciones_val
        ):
            select_mes = sel
            continue
        if (
            select_dia is None
            and len(opciones_val) >= 28
            and (f"{dia_num:02d}" in opciones_val or str(dia_num) in opciones_val)
        ):
            select_dia = sel
            continue

    if not (select_anio and select_mes and select_dia):
        log(
            "No se encontraron las 3 listas de 'Periodo emisión' (año/mes/día) en esta "
            f"pantalla (año={'sí' if select_anio else 'no'}, mes={'sí' if select_mes else 'no'}, "
            f"día={'sí' if select_dia else 'no'}) — se sigue sin filtrar por fecha."
        )
        return False

    def elegir(select_el, candidatos_valor, candidatos_texto=None):
        for valor in candidatos_valor:
            try:
                select_el.select_option(value=valor)
                return True
            except Exception:
                continue
        for texto in candidatos_texto or []:
            try:
                select_el.select_option(label=texto)
                return True
            except Exception:
                continue
        return False

    if not elegir(select_anio, [anio]):
        log("No se pudo elegir el año en el filtro de 'Periodo emisión'.")
        return False
    if not elegir(select_mes, [f"{mes_num:02d}", str(mes_num)], [MESES_ES[mes_num - 1].capitalize()]):
        log("No se pudo elegir el mes en el filtro de 'Periodo emisión'.")
        return False
    if not elegir(select_dia, [f"{dia_num:02d}", str(dia_num)]):
        log("No se pudo elegir el día en el filtro de 'Periodo emisión'.")
        return False

    log(f"Filtro de fecha aplicado (Periodo emisión): {fecha}")

    boton_buscar = encontrar_elemento(
        pagina, SELECTORES_BOTON_BUSCAR_FECHA, "botón buscar/consultar", timeout=3000
    )
    if boton_buscar:
        try:
            boton_buscar.click()
            try:
                pagina.wait_for_load_state("networkidle", timeout=15000)
            except PlaywrightTimeoutError:
                pagina.wait_for_load_state("domcontentloaded", timeout=8000)
            log("Búsqueda con filtro de fecha enviada.")
        except Exception as exc:
            log(f"No se pudo hacer clic en el botón de Consultar: {exc}")
    else:
        log("Se llenó el filtro de fecha pero no se encontró un botón de Consultar explícito.")

    return True


def intentar_click_menu_comprobantes_recibidos(pagina) -> bool:
    """
    Plan B para llegar a comprobantes recibidos: si ninguna URL directa
    funcionó, vuelve al menú principal de SRI en Línea (ya con sesión
    iniciada) y hace clic en el enlace cuyo texto es literalmente
    "Comprobantes electrónicos recibidos" — el mismo que usarías tú a
    mano. Es más confiable que una URL fija porque no depende de un id
    interno que puede variar según tu tipo de cuenta/régimen.
    """
    try:
        pagina.goto(
            "https://srienlinea.sri.gob.ec/sri-en-linea/",
            wait_until="networkidle",
            timeout=30000,
        )
        pagina.wait_for_timeout(1000)

        # El enlace real está anidado dentro de la sección "Facturación
        # Electrónica" del menú (confirmado con una captura de pantalla
        # real) — si esa sección está colapsada, "Comprobantes electrónicos
        # recibidos" ni siquiera aparece en la página. Se abre primero.
        try:
            encabezado_seccion = pagina.get_by_text("Facturación Electrónica", exact=False).first
            encabezado_seccion.click(timeout=5000)
            pagina.wait_for_timeout(700)
        except Exception as exc_seccion:
            log(f"No se pudo abrir la sección 'Facturación Electrónica' del menú (puede que ya estuviera abierta): {exc_seccion}")

        # Diagnóstico: guarda en el log qué hay realmente en el menú en este
        # momento. Si "Comprobantes electrónicos recibidos" no aparece
        # todavía, esto muestra qué encabezados SÍ están visibles — puede
        # que haga falta abrir antes una sección colapsada del menú.
        try:
            contenido_completo = pagina.content()
            idx = contenido_completo.lower().find("recibidos")
            if idx != -1:
                inicio = max(0, idx - 500)
                fin = min(len(contenido_completo), idx + 500)
                log("[DIAGNÓSTICO] HTML alrededor de 'recibidos' en el menú: " + contenido_completo[inicio:fin])
            else:
                encabezados = pagina.eval_on_selector_all(
                    "a.ui-panelmenu-header-link, .ui-menuitem-text",
                    "els => els.map(e => (e.textContent || '').trim()).filter(Boolean)",
                )
                log(
                    "[DIAGNÓSTICO] El texto 'recibidos' todavía no aparece en el HTML del menú "
                    "(puede que haga falta abrir una sección primero). Textos de menú visibles: "
                    + str(encabezados[:40])
                )
        except Exception as exc_diag:
            log(f"[DIAGNÓSTICO] No se pudo inspeccionar el menú: {exc_diag}")

        enlace = pagina.get_by_text(TEXTO_MENU_COMPROBANTES_RECIBIDOS, exact=False).first
        enlace.scroll_into_view_if_needed(timeout=5000)
        # El menú del SRI es un acordeón (PrimeNG) — a veces el enlace real
        # está debajo del encabezado de otra sección mientras termina de
        # abrirse/animarse, y Playwright rechaza el clic por "no estable" o
        # "intercepted". Se le da un respiro y, si el clic normal sigue
        # fallando, se fuerza (salta esas validaciones de estabilidad).
        pagina.wait_for_timeout(500)
        try:
            enlace.click(timeout=8000)
        except Exception as exc_click:
            log(f"El clic normal en el menú falló ({exc_click}); probando con clic forzado...")
            enlace.click(timeout=5000, force=True)
        try:
            pagina.wait_for_load_state("networkidle", timeout=20000)
        except PlaywrightTimeoutError:
            pagina.wait_for_load_state("domcontentloaded", timeout=10000)

        en_login = (
            "login" in pagina.url.lower()
            or "auth/realms" in pagina.url.lower()
            or parece_pantalla_login(pagina)
        )
        parece_pantalla_correcta = "comprobante" in pagina.url.lower() or "recibidos" in pagina.url.lower()
        if not parece_pantalla_correcta:
            try:
                titulo = (pagina.title() or "").lower()
                if "comprobante" in titulo or "recibidos" in titulo:
                    parece_pantalla_correcta = True
            except Exception:
                pass
        exito = not en_login and parece_pantalla_correcta
        if exito:
            log(f"Se llegó a comprobantes recibidos haciendo clic en el menú: {pagina.url}")
        elif en_login:
            log(f"El clic en el menú terminó pidiendo login de nuevo: {pagina.url}")
        else:
            log(
                "El clic en el menú no llevó a la pantalla de comprobantes esperada "
                f"(terminó en: {pagina.url}) — puede que haya hecho clic en el enlace equivocado."
            )
        return exito
    except Exception as exc:
        log(f"No se pudo hacer clic en el menú '{TEXTO_MENU_COMPROBANTES_RECIBIDOS}': {exc}")
        return False


def descargar_xml_sri(
    usuario: str, clave: str, ci_adicional: str, debug: bool, fecha: str | None = None
) -> list[Path]:
    """
    Inicia sesión en SRI en Línea y descarga los XML de comprobantes
    electrónicos recibidos disponibles.
    """
    DESCARGAS_DIR.mkdir(exist_ok=True)
    archivos_descargados: list[Path] = []

    with sync_playwright() as p:
        navegador = p.chromium.launch(headless=not debug)
        contexto = navegador.new_context(
            accept_downloads=True,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        )
        pagina = contexto.new_page()

        log("Abriendo SRI en Línea...")
        try:
            pagina.goto(SRI_LOGIN_URL, wait_until="networkidle", timeout=60000)
        except Exception:
            pagina.goto(SRI_LOGIN_URL, wait_until="domcontentloaded", timeout=60000)

        if debug:
            log("[DEBUG] Navegador abierto. Revisa la página de login.")
            log(f"[DEBUG] URL actual: {pagina.url}")
            pausa_debug("[DEBUG] Presiona Enter para continuar con el login automático (o espera, sigue solo — no cierres la ventana)...")

        # --- Login con múltiples selectores ---
        campo_usuario = encontrar_elemento(pagina, SELECTORES_USUARIO, "campo usuario", timeout=10000)
        campo_clave = encontrar_elemento(pagina, SELECTORES_CLAVE, "campo contraseña", timeout=5000)

        if not campo_usuario or not campo_clave:
            log("ERROR: No se encontraron los campos de login.")
            log(f"URL actual: {pagina.url}")
            log("Ejecuta con --debug para inspeccionar el portal manualmente.")
            log("Selectores probados para usuario: " + str(SELECTORES_USUARIO))
            if debug:
                pausa_debug("[DEBUG] Inspecciona el formulario y presiona Enter para salir (o espera, sigue solo — no cierres la ventana)...")
            navegador.close()
            raise RuntimeError("No se encontraron los campos de login del SRI.")

        campo_usuario.fill(usuario)
        campo_clave.fill(clave)

        if ci_adicional:
            try:
                pagina.fill(SELECTOR_CI_ADICIONAL, ci_adicional, timeout=3000)
                log("Campo 'C.I. adicional' completado.")
            except PlaywrightTimeoutError:
                log("No se encontró el campo 'C.I. adicional' (se continúa sin llenarlo).")

        btn_login = encontrar_elemento(pagina, SELECTORES_BTN_LOGIN, "botón login", timeout=5000)
        if btn_login:
            btn_login.click()
        else:
            # Fallback: enviar el formulario con Enter
            log("Botón de login no encontrado, enviando formulario con Enter...")
            campo_clave.press("Enter")

        try:
            pagina.wait_for_load_state("networkidle", timeout=30000)
        except PlaywrightTimeoutError:
            try:
                pagina.wait_for_load_state("domcontentloaded", timeout=15000)
            except PlaywrightTimeoutError:
                log(
                    "AVISO: la página tardó demasiado en cargar después del login "
                    "(puede ser el internet o que el portal del SRI esté lento en este momento). "
                    "Se continúa de todas formas — si no llega a comprobantes, vuelve a intentarlo en un rato."
                )

        if debug:
            log(f"[DEBUG] URL tras login: {pagina.url}")
            pausa_debug("[DEBUG] ¿Inició sesión? Presiona Enter para ir a comprobantes (o espera, sigue solo en unos segundos — no cierres la ventana)...")

        # --- Navegar a comprobantes recibidos ---
        # Primero se intenta como lo haría una persona real: entrar al menú
        # principal y hacer clic en "Comprobantes electrónicos recibidos".
        # Es más confiable que adivinar una URL directa — con pruebas reales
        # se confirmó que varias de esas URLs directas en realidad llevan a
        # una página "no encontrada" o a la pantalla de login de otra
        # sub-aplicación del SRI, sin avisar con un error obvio. Si el clic
        # en el menú falla, se prueban las URLs directas como respaldo.
        url_comprobantes = None
        log("Yendo al menú de SRI en Línea para entrar a 'Comprobantes electrónicos recibidos'...")
        if intentar_click_menu_comprobantes_recibidos(pagina):
            url_comprobantes = pagina.url

        if not url_comprobantes:
            log("El clic en el menú no funcionó — probando URLs directas conocidas como respaldo...")
            for url_candidato in SRI_COMPROBANTES_URLS_CANDIDATOS:
                try:
                    log(f"Intentando URL de comprobantes: {url_candidato}")
                    pagina.goto(url_candidato, wait_until="networkidle", timeout=30000)
                    # Dale un respiro al router (Angular) del portal: a veces la
                    # página queda "networkidle" un instante antes de que el
                    # router decida que la ruta no es válida y te manda a
                    # "pagina-no-encontrada" — sin esta pausa lo detectaríamos
                    # como si hubiera funcionado.
                    try:
                        pagina.wait_for_timeout(1500)
                    except Exception:
                        pass
                    url_actual = pagina.url.lower()
                    es_login = "login" in url_actual or "inicio" in url_actual
                    es_404 = "no-encontrada" in url_actual or "no encontrada" in url_actual or "404" in url_actual
                    if not es_404:
                        try:
                            inicio_contenido = pagina.content().lower()[:3000]
                            if "no encontrada" in inicio_contenido or "página no existe" in inicio_contenido:
                                es_404 = True
                        except Exception:
                            pass
                    if not es_login and not es_404 and parece_pantalla_login(pagina):
                        es_login = True
                        log(f"URL {url_candidato} en realidad muestra una pantalla de inicio de sesión de otra sub-aplicación del SRI.")
                    # Si llegamos aquí sin excepción, la URL no redirigió al login
                    # y tampoco terminó en una página "no encontrada", asumimos que funciona
                    if not es_login and not es_404:
                        url_comprobantes = url_candidato
                        log(f"URL de comprobantes activa: {url_comprobantes}")
                        break
                    elif es_404:
                        log(f"URL {url_candidato} llevó a una página 'no encontrada' (esa ruta directa no sirve en este portal) — probando la siguiente opción.")
                    else:
                        log(f"URL redirigió o pidió login de nuevo (probablemente sesión expirada o URL incorrecta): {pagina.url}")
                except Exception as exc:
                    log(f"URL {url_candidato} no accesible: {exc}")
                    continue

        if not url_comprobantes:
            log("ADVERTENCIA: Ninguna URL de comprobantes funcionó correctamente.")
            log(f"URL actual: {pagina.url}")
            if debug:
                pausa_debug("[DEBUG] Navega manualmente al módulo de comprobantes recibidos y presiona Enter (o espera, sigue solo — no cierres la ventana)...")

        # --- Filtrar por fecha: la que se haya elegido, o ayer por defecto ---
        fecha_objetivo = fecha or fecha_ayer()
        aplicar_filtro_fecha(pagina, debug, fecha_objetivo)

        if debug:
            log(f"[DEBUG] URL comprobantes: {pagina.url}")
            pausa_debug(f"[DEBUG] ¿Ves el listado de comprobantes de {fecha_objetivo}? Presiona Enter para descargar (o espera, sigue solo en 15 segundos — NO cierres la ventana, se cierra sola cuando termine)...", segundos_si_no_hay_terminal=15.0)

        # Esperar a que cargue la tabla
        time.sleep(2)

        # --- Encontrar botones de descarga XML ---
        # Primero por la columna real "Documento" de la tabla (confirmado
        # con una captura real: el ícono de descarga del XML vive ahí, no
        # es un enlace de texto "XML" como se había supuesto antes).
        botones_encontrados = []
        try:
            tabla_resultados = (
                pagina.query_selector("table.ui-datatable-data")
                or pagina.query_selector(".ui-datatable")
                or pagina.query_selector("table")
            )
        except Exception:
            tabla_resultados = None

        if tabla_resultados:
            indice_documento = encontrar_indice_columna(tabla_resultados, "Documento")
            if indice_documento is not None:
                try:
                    filas = tabla_resultados.query_selector_all("tbody tr")
                    if not filas:
                        filas = tabla_resultados.query_selector_all("tr")[1:]
                except Exception:
                    filas = []
                for fila in filas:
                    try:
                        celdas = fila.query_selector_all("td")
                        if len(celdas) > indice_documento:
                            celda_doc = celdas[indice_documento]
                            clic_elemento = (
                                celda_doc.query_selector("img")
                                or celda_doc.query_selector("a")
                                or celda_doc.query_selector("button")
                            )
                            if clic_elemento:
                                botones_encontrados.append(clic_elemento)
                    except Exception:
                        continue
                if botones_encontrados:
                    log(
                        f"Columna 'Documento' encontrada en la tabla (índice {indice_documento}) → "
                        f"{len(botones_encontrados)} ícono(s) de descarga."
                    )

        if not botones_encontrados:
            # Respaldo: los selectores adivinados de antes, por si la
            # estructura de la tabla cambia.
            for selector in SELECTORES_XML:
                botones = pagina.query_selector_all(selector)
                if botones:
                    log(f"Selector de XML activo: '{selector}' → {len(botones)} elemento(s)")
                    botones_encontrados = botones
                    break

        if not botones_encontrados:
            log("ADVERTENCIA: No se encontraron botones de descarga de XML.")
            log("Puede que el listado esté vacío, o que el selector necesite ajuste.")
            log("Selectores probados: " + str(SELECTORES_XML))
            log("Ejecuta con --debug para inspeccionar el HTML del listado.")
            if debug:
                log("[DEBUG] Buscando la tabla de resultados para diagnóstico...")
                volcado_tabla = None
                try:
                    tabla = (
                        pagina.query_selector("table.ui-datatable-data")
                        or pagina.query_selector(".ui-datatable")
                        or pagina.query_selector("table")
                    )
                    if tabla:
                        volcado_tabla = tabla.inner_html()
                except Exception:
                    pass
                if not volcado_tabla:
                    try:
                        contenido_completo = pagina.content()
                        idx = contenido_completo.lower().find("autorizaci")
                        if idx != -1:
                            volcado_tabla = contenido_completo[idx : idx + 6000]
                    except Exception:
                        pass
                if volcado_tabla:
                    log("[DEBUG] HTML de la tabla de resultados (hasta 6000 caracteres): " + volcado_tabla[:6000])
                else:
                    log("[DEBUG] No se pudo aislar la tabla de resultados — contenido de la página (primeros 3000 chars):")
                    log(pagina.content()[:3000])
                pausa_debug("[DEBUG] Inspecciona el listado manualmente y presiona Enter (o espera, sigue solo en 15 segundos — NO cierres la ventana, se cierra sola cuando termine)...", segundos_si_no_hay_terminal=15.0)
            navegador.close()
            return archivos_descargados

        log(f"Se encontraron {len(botones_encontrados)} comprobante(s) para descargar.")

        for i, boton in enumerate(botones_encontrados, start=1):
            try:
                with pagina.expect_download(timeout=30000) as descarga_info:
                    boton.click()
                descarga = descarga_info.value
                nombre = descarga.suggested_filename or f"comprobante_{i}.xml"
                destino = DESCARGAS_DIR / nombre
                descarga.save_as(destino)
                archivos_descargados.append(destino)
                log(f"Descargado ({i}/{len(botones_encontrados)}): {destino.name}")
                time.sleep(0.5)  # Pausa breve entre descargas
            except PlaywrightTimeoutError:
                log(f"No se pudo descargar el comprobante #{i} (tiempo agotado).")
            except Exception as exc:
                log(f"Error al descargar el comprobante #{i}: {exc}")

        navegador.close()

    return archivos_descargados


def obtener_xmls_pendientes() -> list[Path]:
    """Retorna los XMLs descargados previamente que aún no se han subido."""
    if not DESCARGAS_DIR.exists():
        return []
    return [
        f for f in DESCARGAS_DIR.iterdir()
        if f.is_file() and f.suffix.lower() == ".xml"
    ]


def importar_a_la_app(correo: str, contrasena: str, archivos: list[Path]) -> None:
    if not archivos:
        log("No hay archivos nuevos para importar.")
        return

    log("Verificando que el backend local esté disponible...")
    try:
        respuesta = requests.post(
            f"{API_BASE_URL}/auth/login",
            json={"correo": correo, "contrasena": contrasena},
            timeout=15,
        )
    except requests.exceptions.ConnectionError:
        log(
            f"No pude conectarme al backend en {API_BASE_URL}. "
            "¿Está corriendo Docker (docker compose up -d desde c:\\fintech)? "
            "Los XML quedaron en 'descargas/' y se subirán en la próxima ejecución."
        )
        return

    if respuesta.status_code == 401:
        log(
            "El backend rechazó el correo/contraseña de la app "
            "(APP_CORREO / APP_CONTRASENA en credenciales.env). Revísalos."
        )
        return

    respuesta.raise_for_status()
    token = respuesta.json()["accessToken"]
    log(f"Login en la app exitoso. Subiendo {len(archivos)} XML...")

    archivos_abiertos = [(a, open(a, "rb")) for a in archivos]
    try:
        files = [
            ("archivos", (a.name, fh, "application/xml"))
            for a, fh in archivos_abiertos
        ]
        resp = requests.post(
            f"{API_BASE_URL}/comprobantes-recibidos/importar",
            headers={"Authorization": f"Bearer {token}"},
            files=files,
            timeout=120,
        )
    finally:
        for _, fh in archivos_abiertos:
            fh.close()

    resp.raise_for_status()
    resultado = resp.json()
    log(
        f"✅ Importación completa: "
        f"{resultado.get('procesados', 0)} procesados, "
        f"{resultado.get('duplicados', 0)} duplicados ignorados, "
        f"{resultado.get('noReconocidos', 0)} no reconocidos, "
        f"{resultado.get('errores', 0)} con error."
    )

    # Mover archivos procesados a carpeta por fecha
    carpeta_destino = PROCESADOS_DIR / datetime.now().strftime("%Y-%m-%d")
    carpeta_destino.mkdir(parents=True, exist_ok=True)
    for archivo in archivos:
        try:
            shutil.move(str(archivo), str(carpeta_destino / archivo.name))
        except OSError as exc:
            log(f"No pude mover {archivo.name} a procesados/: {exc}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Descarga comprobantes del SRI y los importa a la app FinTech."
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Abre el navegador visible y pausa en los pasos clave para inspeccionar el portal.",
    )
    parser.add_argument(
        "--solo-subir",
        action="store_true",
        help="Salta el paso del SRI y solo sube los XML que ya están en la carpeta descargas/.",
    )
    parser.add_argument(
        "--fecha",
        metavar="DD/MM/AAAA",
        default=None,
        help="Descarga solo los comprobantes de este día en vez del día anterior a hoy (que es el "
        "valor por defecto). Ejemplo: --fecha 15/08/2026",
    )
    args = parser.parse_args()

    if args.fecha and not fecha_valida(args.fecha):
        sys.exit(f"--fecha inválida: '{args.fecha}'. Usa el formato DD/MM/AAAA, por ejemplo 15/08/2026.")

    creds = cargar_credenciales()
    log("=" * 60)
    log("=== Inicio de ejecución ===")
    log(f"Modo: {'DEBUG' if args.debug else 'NORMAL'}{' + SOLO-SUBIR' if args.solo_subir else ''}")
    log(f"Fecha a descargar: {args.fecha or (fecha_ayer() + ' (ayer, por defecto)')}")

    try:
        if args.solo_subir:
            archivos = obtener_xmls_pendientes()
            log(f"Modo solo-subir: {len(archivos)} XML(s) encontrados en descargas/")
        else:
            archivos = descargar_xml_sri(
                creds["SRI_USUARIO"], creds["SRI_CLAVE"], creds["SRI_CI_ADICIONAL"], args.debug, args.fecha
            )

        importar_a_la_app(creds["APP_CORREO"], creds["APP_CONTRASENA"], archivos)
    except Exception as exc:
        log(f"ERROR: {exc}")
        if "has been closed" in str(exc) or "TargetClosedError" in type(exc).__name__:
            log("AVISO: el navegador se cerró antes de que el script terminara.")
            log("Si cerraste la ventana del navegador a mano: no hace falta — el script la cierra solo cuando termina.")
            log("Vuelve a intentarlo y deja la ventana del navegador abierta sin tocarla; en modo debug avanza sola cada pocos segundos.")
        raise
    finally:
        log("=== Fin de ejecución ===")
        log("=" * 60)


if __name__ == "__main__":
    main()
