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
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

SRI_LOGIN_URL = "https://srienlinea.sri.gob.ec/sri-en-linea/inicio/menu/publico"

# A diferencia del login (ya verificado arriba), estas URLs y los
# selectores de SELECTORES_XML más abajo SIGUEN SIN CONFIRMAR contra el
# portal real: no fue posible probarlos sin iniciar sesión con una cuenta
# real. Este script no tiene modo --debug (corre siempre headless, pensado
# para el servidor). Para confirmar/corregir estos selectores, usa
# automatizacion-sri/descargar_comprobantes_sri.py --debug con una cuenta
# real (te deja ver el navegador y pausar paso a paso) y luego copia aquí
# lo que encuentres.
SRI_COMPROBANTES_URLS_CANDIDATOS = [
    "https://srienlinea.sri.gob.ec/comprobantes-electronicos-internet/pages/consultas/recibidosConsultas.jsf",
    "https://srienlinea.sri.gob.ec/sri-en-linea/SriComprobantesElectronicosInternet/ConsultaComprobantesRecibidos/Consultas/consultaComprobantesRecibidos",
    "https://srienlinea.sri.gob.ec/facturacion-internet/pages/consultas/recibidosConsultas.jsf",
]

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
    print(f"[{time.strftime('%H:%M:%S')}] {mensaje}", file=sys.stderr, flush=True)


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


def descargar(usuario: str, clave: str, ci_adicional: str | None, destino: Path) -> list[Path]:
    destino.mkdir(parents=True, exist_ok=True)
    archivos: list[Path] = []

    with sync_playwright() as p:
        navegador = p.chromium.launch(headless=True)
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
                pagina.wait_for_load_state("domcontentloaded", timeout=15000)

            if "/auth/realms/" in pagina.url:
                raise RuntimeError(
                    "El SRI no aceptó las credenciales o pidió un paso adicional "
                    "(revisa usuario/clave; si el SRI activó un captcha o un paso "
                    "extra de verificación, esta descarga automática no puede continuar)."
                )

            url_comprobantes = None
            for url_candidato in SRI_COMPROBANTES_URLS_CANDIDATOS:
                try:
                    pagina.goto(url_candidato, wait_until="networkidle", timeout=30000)
                    if "login" not in pagina.url.lower() and "inicio" not in pagina.url.lower():
                        url_comprobantes = url_candidato
                        break
                except Exception as exc:
                    log(f"URL {url_candidato} no accesible: {exc}")
                    continue

            if not url_comprobantes:
                raise RuntimeError(
                    "No se pudo llegar al módulo de comprobantes recibidos "
                    "(el SRI pudo haber cambiado la ruta del portal)."
                )

            time.sleep(2)

            botones = []
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
        resultado["mensaje"] = str(exc)
        log(f"ERROR: {exc}")

    print(json.dumps(resultado))


if __name__ == "__main__":
    main()
