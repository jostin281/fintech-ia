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
from datetime import datetime
from pathlib import Path

import requests
from dotenv import load_dotenv
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

BASE_DIR = Path(__file__).resolve().parent
DESCARGAS_DIR = BASE_DIR / "descargas"
PROCESADOS_DIR = DESCARGAS_DIR / "procesados"
LOG_FILE = BASE_DIR / "descargar_comprobantes_sri.log"

SRI_LOGIN_URL = "https://srienlinea.sri.gob.ec/sri-en-linea/inicio/menu/publico"
SRI_COMPROBANTES_URL = (
    "https://srienlinea.sri.gob.ec/sri-en-linea/"
    "SriRucInternet/ConsultaRuc/Consultas/consultaRuc"
)

# Múltiples candidatos de URL para comprobantes recibidos (el portal SRI
# cambia sus rutas periódicamente — se prueban en orden hasta encontrar una).
# A diferencia del login (ya verificado arriba), estas URLs y los
# selectores de SELECTORES_XML más abajo SIGUEN SIN CONFIRMAR contra el
# portal real: no fue posible probarlos sin iniciar sesión con una cuenta
# real. Corre este script con --debug y una cuenta real para confirmarlos
# o corregirlos.
SRI_COMPROBANTES_URLS_CANDIDATOS = [
    "https://srienlinea.sri.gob.ec/comprobantes-electronicos-internet/pages/consultas/recibidosConsultas.jsf",
    "https://srienlinea.sri.gob.ec/sri-en-linea/SriComprobantesElectronicosInternet/ConsultaComprobantesRecibidos/Consultas/consultaComprobantesRecibidos",
    "https://srienlinea.sri.gob.ec/facturacion-internet/pages/consultas/recibidosConsultas.jsf",
]

API_BASE_URL = "http://localhost:3001/api"

# Selectores del portal SRI en Línea (JSF). Se prueban en orden; el primero
# que encuentre el elemento es el que se usa. Si todos fallan con --debug,
# inspecciona el HTML real y actualiza el primer elemento de cada lista.
# Verificados el 2026-08-28 inspeccionando el DOM real de
# https://srienlinea.sri.gob.ec. El portal hoy corre el login sobre
# Keycloak/OIDC, NO sobre el portal JSF viejo que asumía la primera
# versión de este script (por eso los selectores originales casi seguro
# no funcionaban). El primero de cada lista es el confirmado; los demás
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


def descargar_xml_sri(usuario: str, clave: str, ci_adicional: str, debug: bool) -> list[Path]:
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
            input("[DEBUG] Presiona Enter para continuar con el login automático...")

        # --- Login con múltiples selectores ---
        campo_usuario = encontrar_elemento(pagina, SELECTORES_USUARIO, "campo usuario", timeout=10000)
        campo_clave = encontrar_elemento(pagina, SELECTORES_CLAVE, "campo contraseña", timeout=5000)

        if not campo_usuario or not campo_clave:
            log("ERROR: No se encontraron los campos de login.")
            log(f"URL actual: {pagina.url}")
            log("Ejecuta con --debug para inspeccionar el portal manualmente.")
            log("Selectores probados para usuario: " + str(SELECTORES_USUARIO))
            if debug:
                input("[DEBUG] Inspecciona el formulario y presiona Enter para salir...")
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
            pagina.wait_for_load_state("domcontentloaded", timeout=15000)

        if debug:
            log(f"[DEBUG] URL tras login: {pagina.url}")
            input("[DEBUG] ¿Inició sesión? Presiona Enter para ir a comprobantes...")

        # --- Navegar a comprobantes recibidos ---
        url_comprobantes = None
        for url_candidato in SRI_COMPROBANTES_URLS_CANDIDATOS:
            try:
                log(f"Intentando URL de comprobantes: {url_candidato}")
                pagina.goto(url_candidato, wait_until="networkidle", timeout=30000)
                # Si llegamos aquí sin excepción y la URL no redirigió al login, asumimos que funciona
                if "login" not in pagina.url.lower() and "inicio" not in pagina.url.lower():
                    url_comprobantes = url_candidato
                    log(f"URL de comprobantes activa: {url_comprobantes}")
                    break
                else:
                    log(f"URL redirigió (probablemente sesión expirada o URL incorrecta): {pagina.url}")
            except Exception as exc:
                log(f"URL {url_candidato} no accesible: {exc}")
                continue

        if not url_comprobantes:
            log("ADVERTENCIA: Ninguna URL de comprobantes funcionó correctamente.")
            log(f"URL actual: {pagina.url}")
            if debug:
                input("[DEBUG] Navega manualmente al módulo de comprobantes recibidos y presiona Enter...")

        if debug:
            log(f"[DEBUG] URL comprobantes: {pagina.url}")
            input("[DEBUG] ¿Ves el listado de comprobantes? Presiona Enter para descargar...")

        # Esperar a que cargue la tabla
        time.sleep(2)

        # --- Encontrar botones de descarga XML ---
        botones_encontrados = []
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
                log("[DEBUG] Contenido de la página (primeros 3000 chars):")
                log(pagina.content()[:3000])
                input("[DEBUG] Inspecciona el listado manualmente y presiona Enter...")
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
    args = parser.parse_args()

    creds = cargar_credenciales()
    log("=" * 60)
    log("=== Inicio de ejecución ===")
    log(f"Modo: {'DEBUG' if args.debug else 'NORMAL'}{' + SOLO-SUBIR' if args.solo_subir else ''}")

    try:
        if args.solo_subir:
            archivos = obtener_xmls_pendientes()
            log(f"Modo solo-subir: {len(archivos)} XML(s) encontrados en descargas/")
        else:
            archivos = descargar_xml_sri(
                creds["SRI_USUARIO"], creds["SRI_CLAVE"], creds["SRI_CI_ADICIONAL"], args.debug
            )

        importar_a_la_app(creds["APP_CORREO"], creds["APP_CONTRASENA"], archivos)
    except Exception as exc:
        log(f"ERROR: {exc}")
        raise
    finally:
        log("=== Fin de ejecución ===")
        log("=" * 60)


if __name__ == "__main__":
    main()
