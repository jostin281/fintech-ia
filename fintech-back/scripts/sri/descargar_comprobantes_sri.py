"""
descargar_comprobantes_sri.py (variante multiusuario, invocada por el backend)

Hace SOLO el paso de SRI: inicia sesión en SRI en Línea con las credenciales
que le pasa el backend por variables de entorno, descarga los XML de
comprobantes electrónicos recibidos disponibles, y devuelve el resultado
como una única línea JSON en stdout. El backend (Node) es quien decide qué
hacer con los XML descargados (los importa llamando directamente al mismo
código que usa la importación manual) — este script NO sube nada a la app
ni conoce su API.

Variables de entorno requeridas (las pone el backend, nunca se leen de un
archivo en disco):
  SRI_USUARIO             Usuario/RUC/cédula de SRI en Línea
  SRI_CLAVE               Clave de SRI en Línea
  SRI_DESCARGA_DESTINO    Carpeta donde guardar los XML descargados
  SRI_CI_ADICIONAL        Opcional. Campo "C.I. adicional" del login del SRI
                          (login como tercero autorizado). Si no se pasa,
                          el campo se deja vacío.

Salida: exactamente una línea JSON en stdout con la forma
  {"exito": bool, "archivos": [ "ruta1.xml", ... ], "mensaje": "texto"}

Todo lo demás (progreso, advertencias) va a stderr, para que stdout quede
limpio y el backend pueda parsear el JSON sin ambigüedad. El script SIEMPRE
termina con exit code 0 y JSON válido, incluso si falló — el "exito": false
y el "mensaje" son la forma de reportar el error, no una excepción sin
capturar.

NOTA IMPORTANTE (heredada del script original en automatizacion-sri/):
el portal SRI en Línea usa JavaServer Faces (JSF) con IDs dinámicos. Los
selectores de abajo se probaron con --debug contra una cuenta real; si el
SRI cambia su portal, este script empezará a fallar de forma visible (queda
registrado en "mensaje") en vez de fallar en silencio.
"""

import json
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

# La URL vieja ("/sri-en-linea/inicio/menu/publico") ya no existe — el portal
# ahora es una SPA Angular y esa ruta da 404, por eso nunca se encontraban los
# campos de login (no era un problema de los selectores). Verificado el
# 2026-08-31: entrar a una ruta que exige sesión (como "contribuyente/perfil")
# redirige automáticamente al login real de Keycloak.
SRI_LOGIN_URL = "https://srienlinea.sri.gob.ec/sri-en-linea/contribuyente/perfil"

# CONFIRMADO EN UNA CUENTA REAL el 2026-08-31: la primera URL de abajo
# ("SriComprobantesElectronicosInternet/...") SÍ funciona después de
# iniciar sesión — se probó dos veces (vía automatizacion-sri/
# descargar_comprobantes_sri.py) y llegó sin redirigir a login. Va primera
# en la lista para no perder tiempo con las demás.
#
# La URL "tuportal-internet/accederAplicacion.jspa?redireccion=57..." es
# el href real del enlace de menú "Comprobantes electrónicos recibidos",
# pero en la práctica SIEMPRE redirige a un login nuevo aunque ya haya
# sesión iniciada (esa app usa su propio cliente OIDC con login=true
# forzado), así que se deja al final por si el SRI cambia eso. Los
# selectores de SELECTORES_XML sí siguen sin confirmar — para investigar
# usa automatizacion-sri/descargar_comprobantes_sri.py --debug con una
# cuenta real y luego copia aquí lo que encuentres.
SRI_COMPROBANTES_URLS_CANDIDATOS = [
    # Confirmada con una captura real de pantalla EN RENDER (01/09/2026):
    # la URL "pelona" (sin estos parámetros) NO basta -- el portal SRI es
    # una app JSF y esta pantalla depende del "breadcrumb" de navegación
    # (contextoMPT/pathMPT/actualMPT/linkMPT) que normalmente pone el
    # propio menú al hacer clic; sin él, la ruta "pelona" no muestra el
    # listado. Estos valores son fijos (metadata de navegación, no un
    # token de sesión), así que se pueden dejar tal cual. El "%F3" es
    # literal (así codifica el SRI la "ó" en esta pantalla, en
    # ISO-8859-1, no UTF-8) — no se debe "corregir" a %C3%B3.
    "https://srienlinea.sri.gob.ec/comprobantes-electronicos-internet/pages/consultas/recibidos/comprobantesRecibidos.jsf?&contextoMPT=https://srienlinea.sri.gob.ec/tuportal-internet&pathMPT=Facturaci%F3n%20Electr%F3nica&actualMPT=Comprobantes%20electr%F3nicos%20recibidos%20&linkMPT=%2Fcomprobantes-electronicos-internet%2Fpages%2Fconsultas%2Frecibidos%2FcomprobantesRecibidos.jsf%3F&esFavorito=S",
    # Confirmada con una captura real de pantalla (31/08/2026) — la versión
    # sin esos parámetros; se deja como respaldo por si el SRI deja de
    # exigir el breadcrumb.
    "https://srienlinea.sri.gob.ec/comprobantes-electronicos-internet/pages/consultas/recibidos/comprobantesRecibidos.jsf",
    "https://srienlinea.sri.gob.ec/sri-en-linea/SriComprobantesElectronicosInternet/ConsultaComprobantesRecibidos/Consultas/consultaComprobantesRecibidos",
    "https://srienlinea.sri.gob.ec/comprobantes-electronicos-internet/pages/consultas/recibidosConsultas.jsf",
    "https://srienlinea.sri.gob.ec/facturacion-internet/pages/consultas/recibidosConsultas.jsf",
    "https://srienlinea.sri.gob.ec/tuportal-internet/accederAplicacion.jspa?redireccion=57&idGrupo=55",
]

TEXTO_MENU_COMPROBANTES_RECIBIDOS = "Comprobantes electrónicos recibidos"

# Verificados el 2026-08-28 inspeccionando el DOM real de
# https://srienlinea.sri.gob.ec (formulario "SRI en Línea - Login", que hoy
# corre sobre Keycloak/OIDC, NO sobre el portal JSF viejo que asumía la
# primera versión de este script). Se dejan selectores alternativos después
# solo como respaldo por si el SRI vuelve a cambiar el portal — el primero
# de cada lista es el confirmado.
SELECTORES_USUARIO = [
    "#usuario",
    "input[name='usuario']",
    "input[id*='usuario']",
    "input[type='text']:first-of-type",
]

# Campo opcional "C.I. adicional" (login de un tercero autorizado sobre
# el RUC de otra persona/empresa). Se deja SIN llenar: este script asume
# que cada usuario entra a su propia cuenta con su propio RUC/C.I.
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
# del día anterior a hoy en cada corrida, no todo el historial cada vez).
# A diferencia de los selectores de login, estos NO se pudieron confirmar
# contra el portal real. Si ninguno coincide, el script simplemente sigue
# sin filtrar por fecha — nunca es motivo para detener la descarga.
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


# Buffer en memoria con las últimas líneas de log(). Además de ir a stderr
# (útil si alguien revisa los logs de Render a mano), se usa para armar un
# resumen de diagnóstico que viaja DENTRO del mensaje de error final -- así
# "Última ejecución" en la pantalla de la app ya trae el detalle, sin
# depender de que alguien entre a buscar los logs del contenedor.
_DIAGNOSTICO: list[str] = []


def log(mensaje: str) -> None:
    linea = f"[{time.strftime('%H:%M:%S')}] {mensaje}"
    print(linea, file=sys.stderr, flush=True)
    _DIAGNOSTICO.append(linea)
    del _DIAGNOSTICO[:-60]  # no dejar crecer el buffer sin límite


def resumen_diagnostico(max_lineas: int = 12) -> str:
    if not _DIAGNOSTICO:
        return "(sin líneas de diagnóstico registradas)"
    return " | ".join(_DIAGNOSTICO[-max_lineas:])


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


def encontrar_elemento(pagina, selectores, descripcion, timeout=5000):
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


MESES_ES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]


def aplicar_filtro_fecha_ayer(pagina) -> bool:
    """
    Filtra el listado de comprobantes recibidos por el día anterior a hoy.

    Confirmado con una captura real de la pantalla del SRI: el filtro NO
    son dos campos de texto "desde/hasta" — son tres listas desplegables
    bajo "Periodo emisión": año, mes y día. Se detectan por las opciones
    que tienen adentro, no por un id fijo.
    """
    fecha = fecha_ayer()
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

    log(f"Filtro de fecha aplicado (Periodo emisión): {fecha} (día anterior a hoy)")

    boton_buscar = encontrar_elemento(pagina, SELECTORES_BOTON_BUSCAR_FECHA, "botón buscar/consultar", 3000)
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
            # Recorte corto a propósito (100 caracteres, no 500-1000): esto se
            # manda dentro del mensaje de error final si todo falla, y ese
            # mensaje solo se queda con los últimos ~1000-4000 caracteres —
            # un volcado de HTML largo aquí se comía el registro de los pasos
            # posteriores (qué URL se probó, por qué falló cada una).
            contenido_completo = pagina.content()
            idx = contenido_completo.lower().find("recibidos")
            if idx != -1:
                inicio = max(0, idx - 60)
                fin = min(len(contenido_completo), idx + 60)
                log("[DIAGNÓSTICO] Fragmento HTML cerca de 'recibidos': " + contenido_completo[inicio:fin])
            else:
                encabezados = pagina.eval_on_selector_all(
                    "a.ui-panelmenu-header-link, .ui-menuitem-text",
                    "els => els.map(e => (e.textContent || '').trim()).filter(Boolean)",
                )
                log(
                    "[DIAGNÓSTICO] 'recibidos' no aparece en el menú todavía. Textos visibles: "
                    + str(encabezados[:15])
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


def descargar(usuario: str, clave: str, ci_adicional: str | None, destino: Path) -> list[Path]:
    destino.mkdir(parents=True, exist_ok=True)
    archivos: list[Path] = []

    with sync_playwright() as p:
        # --no-sandbox: Chromium se niega a arrancar corriendo como root
        # (el usuario por defecto en el contenedor Docker de Render) si no
        # se pasa este flag -- sin el, falla siempre con
        # "Running as root without --no-sandbox is not supported".
        # --disable-dev-shm-usage: Docker limita /dev/shm a 64 MB por
        # defecto, y Chromium headless lo agota facil con las paginas
        # pesadas de SRI en Linea, sobre todo con la poca RAM del plan
        # free de Render; con este flag usa /tmp en su lugar.
        navegador = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        )
        contexto = navegador.new_context(
            accept_downloads=True,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        )
        pagina = contexto.new_page()

        try:
            log("Abriendo SRI en Línea...")
            try:
                pagina.goto(SRI_LOGIN_URL, wait_until="networkidle", timeout=60000)
            except Exception:
                pagina.goto(SRI_LOGIN_URL, wait_until="domcontentloaded", timeout=60000)

            campo_usuario = encontrar_elemento(pagina, SELECTORES_USUARIO, "campo usuario", 10000)
            campo_clave = encontrar_elemento(pagina, SELECTORES_CLAVE, "campo contraseña", 5000)

            if not campo_usuario or not campo_clave:
                raise RuntimeError(
                    "No se encontraron los campos de login del SRI (el portal pudo cambiar su HTML)."
                )

            campo_usuario.fill(usuario)
            campo_clave.fill(clave)

            if ci_adicional:
                try:
                    pagina.fill(SELECTOR_CI_ADICIONAL, ci_adicional, timeout=3000)
                    log("Campo 'C.I. adicional' completado.")
                except PlaywrightTimeoutError:
                    log("No se encontró el campo 'C.I. adicional' (se continúa sin llenarlo).")

            btn_login = encontrar_elemento(pagina, SELECTORES_BTN_LOGIN, "botón login", 5000)
            if btn_login:
                btn_login.click()
            else:
                campo_clave.press("Enter")

            try:
                pagina.wait_for_load_state("networkidle", timeout=30000)
            except PlaywrightTimeoutError:
                try:
                    pagina.wait_for_load_state("domcontentloaded", timeout=15000)
                except PlaywrightTimeoutError:
                    log(
                        "AVISO: la página tardó demasiado en cargar después del login "
                        "(internet o portal del SRI lento). Se continúa de todas formas."
                    )

            if "/auth/realms/" in pagina.url:
                raise RuntimeError(
                    "El SRI no aceptó las credenciales o pidió un paso adicional "
                    "(revisa usuario/clave; si el SRI activó un captcha o un paso "
                    "extra de verificación, esta descarga automática no puede continuar)."
                )

            # Primero las URLs directas conocidas (la primera de la lista ya se
            # confirmó con una cuenta real, incluyendo su contexto de
            # navegación MPT) — es rápido y no depende de que el menú se
            # vea/anime igual en el navegador headless del contenedor. Solo
            # si TODAS fallan se recurre al clic del menú como respaldo, que
            # es más lento (tiene que abrir y escanear el acordeón del menú).
            url_comprobantes = None
            for url_candidato in SRI_COMPROBANTES_URLS_CANDIDATOS:
                try:
                    pagina.goto(url_candidato, wait_until="networkidle", timeout=20000)
                    # Dale un respiro al router (Angular) del portal: a veces
                    # queda "networkidle" un instante antes de que decida que
                    # la ruta no es válida y te manda a "pagina-no-encontrada".
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
                    if not es_login and not es_404:
                        url_comprobantes = url_candidato
                        log(f"URL directa funcionó: {url_candidato}")
                        break
                    elif es_404:
                        log(f"URL {url_candidato} llevó a una página 'no encontrada' — probando la siguiente opción.")
                    elif es_login:
                        log(f"URL {url_candidato} pidió login de nuevo — probando la siguiente opción.")
                except Exception as exc:
                    log(f"URL {url_candidato} no accesible: {exc}")
                    continue

            if not url_comprobantes:
                log("Ninguna URL directa funcionó — probando el clic del menú como respaldo...")
                if intentar_click_menu_comprobantes_recibidos(pagina):
                    url_comprobantes = pagina.url

            if not url_comprobantes:
                raise RuntimeError(
                    "No se pudo llegar al módulo de comprobantes recibidos "
                    "(el SRI pudo haber cambiado la ruta del portal). Detalle: "
                    + resumen_diagnostico()
                )

            aplicar_filtro_fecha_ayer(pagina)

            time.sleep(2)

            botones = []
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
                                    botones.append(clic_elemento)
                        except Exception:
                            continue
                    if botones:
                        log(f"Columna 'Documento' encontrada (índice {indice_documento}) → {len(botones)} ícono(s) de descarga.")

            if not botones:
                for selector in SELECTORES_XML:
                    encontrados = pagina.query_selector_all(selector)
                    if encontrados:
                        botones = encontrados
                        log(f"Selector de XML activo: '{selector}' → {len(encontrados)} elemento(s)")
                        break

            if not botones:
                log("No se encontraron comprobantes para descargar (o el selector no coincidió).")
                return archivos

            for i, boton in enumerate(botones, start=1):
                try:
                    with pagina.expect_download(timeout=30000) as descarga_info:
                        boton.click()
                    descarga = descarga_info.value
                    nombre = descarga.suggested_filename or f"comprobante_{i}.xml"
                    ruta = destino / nombre
                    descarga.save_as(ruta)
                    archivos.append(ruta)
                    log(f"Descargado ({i}/{len(botones)}): {ruta.name}")
                    time.sleep(0.5)
                except PlaywrightTimeoutError:
                    log(f"No se pudo descargar el comprobante #{i} (tiempo agotado).")
                except Exception as exc:
                    log(f"Error al descargar el comprobante #{i}: {exc}")
        finally:
            navegador.close()

    return archivos


def main() -> None:
    usuario = os.environ.get("SRI_USUARIO")
    clave = os.environ.get("SRI_CLAVE")
    ci_adicional = os.environ.get("SRI_CI_ADICIONAL") or None
    destino_str = os.environ.get("SRI_DESCARGA_DESTINO")

    resultado = {"exito": False, "archivos": [], "mensaje": ""}

    if not usuario or not clave or not destino_str:
        resultado["mensaje"] = (
            "Faltan variables de entorno SRI_USUARIO / SRI_CLAVE / SRI_DESCARGA_DESTINO."
        )
        print(json.dumps(resultado))
        return

    try:
        archivos = descargar(usuario, clave, ci_adicional, Path(destino_str))
        resultado["exito"] = True
        resultado["archivos"] = [str(a) for a in archivos]
        resultado["mensaje"] = f"{len(archivos)} comprobante(s) descargado(s)."
    except Exception as exc:
        if "has been closed" in str(exc) or "TargetClosedError" in type(exc).__name__:
            resultado["mensaje"] = (
                "El navegador se cerró antes de terminar la descarga (posible falla del navegador "
                "en el contenedor, o se quedó sin memoria). Vuelve a intentarlo."
            )
        else:
            resultado["mensaje"] = str(exc)
        log(f"ERROR: {exc}")

    print(json.dumps(resultado))


if __name__ == "__main__":
    main()
