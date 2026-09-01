"""
panel_control.py

Panel de control con botones para la descarga de comprobantes del SRI.
Es la forma recomendada de usar este script en vez de escribir comandos
a mano en una terminal:

  - Botón "Descargar ahora": corre descargar_comprobantes_sri.py una sola
    vez, en este momento, y muestra el progreso en pantalla.
  - Botón "Activar / Desactivar descarga automática diaria": registra o
    quita la tarea en el Programador de Tareas de Windows (usa
    configurar_tarea_windows.ps1 por debajo) para que corra sola todos
    los días a la hora que elijas.

Se abre haciendo doble clic en panel.bat (o corriendo
`python panel_control.py` desde esta carpeta).
"""

import json
import os
import queue
import subprocess
import sys
import threading
import tkinter as tk
from datetime import datetime, timedelta
from pathlib import Path
from tkinter import messagebox, ttk

try:
    from tkcalendar import DateEntry
    TKCALENDAR_DISPONIBLE = True
except ImportError:
    TKCALENDAR_DISPONIBLE = False

BASE_DIR = Path(__file__).resolve().parent
CREDENCIALES_PATH = BASE_DIR / "credenciales.env"
CREDENCIALES_EJEMPLO = BASE_DIR / "credenciales.env.example"
SCRIPT_DESCARGA = BASE_DIR / "descargar_comprobantes_sri.py"
SCRIPT_TAREA = BASE_DIR / "configurar_tarea_windows.ps1"
LOG_FILE = BASE_DIR / "descargar_comprobantes_sri.log"
CONFIG_PANEL = BASE_DIR / "panel_config.json"
TASK_NAME = "FinTech - Descarga Comprobantes SRI"

CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)


def cargar_hora_guardada() -> str:
    try:
        data = json.loads(CONFIG_PANEL.read_text(encoding="utf-8"))
        hora = data.get("hora", "07:00")
        return hora if isinstance(hora, str) else "07:00"
    except Exception:
        return "07:00"


def guardar_hora(hora: str) -> None:
    try:
        CONFIG_PANEL.write_text(json.dumps({"hora": hora}), encoding="utf-8")
    except Exception:
        pass


def fecha_ayer_str() -> str:
    """Fecha de ayer (respecto a hoy) en formato dd/mm/aaaa, el valor por
    defecto del selector de fecha del panel."""
    return (datetime.now() - timedelta(days=1)).strftime("%d/%m/%Y")


def tarea_registrada() -> bool:
    """True si la tarea de descarga automática ya está registrada en Windows."""
    try:
        resultado = subprocess.run(
            ["schtasks", "/query", "/tn", TASK_NAME],
            capture_output=True,
            creationflags=CREATE_NO_WINDOW,
        )
        return resultado.returncode == 0
    except FileNotFoundError:
        # No estamos en Windows (o no hay schtasks disponible).
        return False


class PanelControl(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("FinTech · Descarga de comprobantes SRI")
        self.geometry("720x640")
        self.minsize(660, 580)
        self.configure(bg="#0f172a")

        self._cola: "queue.Queue[str]" = queue.Queue()
        self._corriendo = False

        self._construir_ui()
        self._refrescar_estado()
        self.after(150, self._poll_cola)

    # ------------------------------------------------------------- UI --

    def _construir_ui(self) -> None:
        estilo = ttk.Style(self)
        try:
            estilo.theme_use("clam")
        except tk.TclError:
            pass

        contenedor = tk.Frame(self, bg="#0f172a", padx=16, pady=16)
        contenedor.pack(fill="both", expand=True)

        tk.Label(
            contenedor,
            text="🤖 Descarga de comprobantes del SRI",
            font=("Segoe UI", 15, "bold"),
            fg="white",
            bg="#0f172a",
        ).pack(anchor="w")
        tk.Label(
            contenedor,
            text="Corre en tu computadora. Descarga los XML de tus comprobantes del SRI y los sube a tu app FinTech.",
            font=("Segoe UI", 9),
            fg="#94a3b8",
            bg="#0f172a",
            wraplength=680,
            justify="left",
        ).pack(anchor="w", pady=(2, 12))

        # --- Sección 1: credenciales ---
        seccion1 = self._crear_seccion(contenedor, "1. Conexión con el SRI (tus credenciales)")
        fila1 = tk.Frame(seccion1, bg="#1e293b")
        fila1.pack(fill="x")
        self.lbl_credenciales = tk.Label(fila1, text="", font=("Segoe UI", 10), bg="#1e293b", anchor="w", justify="left")
        self.lbl_credenciales.pack(side="left", fill="x", expand=True)
        tk.Button(
            fila1,
            text="Configurar credenciales…",
            command=self._configurar_credenciales,
            bg="#334155",
            fg="white",
            relief="flat",
            padx=10,
            pady=4,
            cursor="hand2",
        ).pack(side="right")

        # --- Sección 2: manual ---
        seccion2 = self._crear_seccion(contenedor, "2. Descarga manual (ahora mismo)")
        fila2 = tk.Frame(seccion2, bg="#1e293b")
        fila2.pack(fill="x")
        self.var_debug = tk.BooleanVar(value=False)
        tk.Checkbutton(
            fila2,
            text="Modo debug (ver el navegador paso a paso)",
            variable=self.var_debug,
            bg="#1e293b",
            fg="#94a3b8",
            selectcolor="#1e293b",
            activebackground="#1e293b",
        ).pack(side="left")
        self.btn_manual = tk.Button(
            fila2,
            text="📥 Descargar ahora",
            command=self._descargar_ahora,
            bg="#0ea5e9",
            fg="white",
            relief="flat",
            padx=14,
            pady=6,
            cursor="hand2",
            font=("Segoe UI", 10, "bold"),
        )
        self.btn_manual.pack(side="right")

        fila2b = tk.Frame(seccion2, bg="#1e293b")
        fila2b.pack(fill="x", pady=(8, 0))
        tk.Label(fila2b, text="Día a descargar:", bg="#1e293b", fg="#94a3b8").pack(side="left")

        if TKCALENDAR_DISPONIBLE:
            self.selector_fecha = DateEntry(
                fila2b,
                date_pattern="dd/mm/yyyy",
                background="#0ea5e9",
                foreground="white",
                borderwidth=0,
            )
            try:
                self.selector_fecha.set_date(datetime.now() - timedelta(days=1))
            except Exception:
                pass
            self.selector_fecha.pack(side="left", padx=(6, 0))
        else:
            self.selector_fecha = None
            self.var_fecha_manual = tk.StringVar(value=fecha_ayer_str())
            tk.Entry(fila2b, textvariable=self.var_fecha_manual, width=12, justify="center").pack(
                side="left", padx=(6, 0)
            )
            tk.Label(
                fila2b,
                text="(formato DD/MM/AAAA — instala 'tkcalendar' para ver un calendario)",
                bg="#1e293b",
                fg="#64748b",
                font=("Segoe UI", 8),
            ).pack(side="left", padx=(8, 0))

        # --- Sección 3: automática ---
        seccion3 = self._crear_seccion(contenedor, "3. Descarga automática (todos los días)")
        fila3 = tk.Frame(seccion3, bg="#1e293b")
        fila3.pack(fill="x", pady=(0, 6))
        self.lbl_automatica = tk.Label(fila3, text="", font=("Segoe UI", 10), bg="#1e293b", anchor="w", justify="left", wraplength=560)
        self.lbl_automatica.pack(side="left", fill="x", expand=True)

        fila3b = tk.Frame(seccion3, bg="#1e293b")
        fila3b.pack(fill="x")
        tk.Label(fila3b, text="Hora todos los días (HH:MM):", bg="#1e293b", fg="#94a3b8").pack(side="left")
        self.var_hora = tk.StringVar(value=cargar_hora_guardada())
        tk.Entry(fila3b, textvariable=self.var_hora, width=7, justify="center").pack(side="left", padx=(6, 12))
        self.btn_auto = tk.Button(
            fila3b,
            text="…",
            command=self._alternar_automatica,
            bg="#7c3aed",
            fg="white",
            relief="flat",
            padx=14,
            pady=6,
            cursor="hand2",
            font=("Segoe UI", 10, "bold"),
        )
        self.btn_auto.pack(side="right")

        # --- Registro / log ---
        seccion4 = self._crear_seccion(contenedor, "Registro de actividad")
        self.texto_log = tk.Text(
            seccion4,
            height=12,
            bg="#0b1220",
            fg="#cbd5e1",
            insertbackground="white",
            relief="flat",
            font=("Consolas", 9),
            wrap="word",
        )
        self.texto_log.pack(fill="both", expand=True)
        self.texto_log.configure(state="disabled")

        fila_log = tk.Frame(contenedor, bg="#0f172a")
        fila_log.pack(fill="x", pady=(8, 0))
        tk.Button(
            fila_log,
            text="Abrir log completo",
            command=self._abrir_log,
            bg="#334155",
            fg="white",
            relief="flat",
            padx=10,
            pady=4,
            cursor="hand2",
        ).pack(side="left")
        tk.Button(
            fila_log,
            text="🔄 Actualizar estado",
            command=self._refrescar_estado,
            bg="#334155",
            fg="white",
            relief="flat",
            padx=10,
            pady=4,
            cursor="hand2",
        ).pack(side="right")

    def _crear_seccion(self, padre: tk.Widget, titulo: str) -> tk.Frame:
        marco = tk.Frame(
            padre,
            bg="#1e293b",
            padx=12,
            pady=10,
            highlightbackground="#334155",
            highlightthickness=1,
        )
        marco.pack(fill="x", pady=(0, 10))
        tk.Label(marco, text=titulo, font=("Segoe UI", 10, "bold"), fg="white", bg="#1e293b").pack(anchor="w", pady=(0, 6))
        return marco

    # -------------------------------------------------------- Estado --

    def _refrescar_estado(self) -> None:
        if CREDENCIALES_PATH.exists():
            self.lbl_credenciales.config(text="✅ credenciales.env configurado.", fg="#34d399")
        else:
            self.lbl_credenciales.config(
                text="⚠️ Falta configurar credenciales.env con tu usuario y clave del SRI (y tu correo/contraseña de la app).",
                fg="#f59e0b",
            )

        activa = tarea_registrada()
        if activa:
            self.lbl_automatica.config(
                text=f"⏰ Activada: se descarga sola todos los días. Tarea de Windows: “{TASK_NAME}”.",
                fg="#34d399",
            )
            self.btn_auto.config(text="Desactivar descarga automática", bg="#ef4444")
        else:
            self.lbl_automatica.config(
                text="Desactivada: solo se descarga cuando presionas “Descargar ahora”.",
                fg="#94a3b8",
            )
            self.btn_auto.config(text="Activar descarga automática", bg="#7c3aed")

    # ------------------------------------------------- Acción: credenciales --

    def _configurar_credenciales(self) -> None:
        if not CREDENCIALES_PATH.exists():
            if CREDENCIALES_EJEMPLO.exists():
                CREDENCIALES_PATH.write_text(CREDENCIALES_EJEMPLO.read_text(encoding="utf-8"), encoding="utf-8")
            else:
                CREDENCIALES_PATH.write_text(
                    "SRI_USUARIO=\nSRI_CLAVE=\nSRI_CI_ADICIONAL=\nAPP_CORREO=\nAPP_CONTRASENA=\n",
                    encoding="utf-8",
                )
        try:
            os.startfile(str(CREDENCIALES_PATH))  # type: ignore[attr-defined]
        except Exception:
            subprocess.Popen(["notepad.exe", str(CREDENCIALES_PATH)])
        messagebox.showinfo(
            "Credenciales",
            "Completa tu usuario y clave del SRI (y tu correo/contraseña de la app) en el "
            "Bloc de notas que se abrió, guarda el archivo y vuelve aquí.\n\n"
            "Presiona “🔄 Actualizar estado” cuando termines.",
        )

    # ------------------------------------------------------ Acción: manual --

    def _fecha_seleccionada(self) -> str:
        """Fecha elegida en el calendario (o en el campo de texto de
        respaldo), en formato dd/mm/aaaa."""
        if TKCALENDAR_DISPONIBLE and self.selector_fecha is not None:
            return self.selector_fecha.get_date().strftime("%d/%m/%Y")
        return self.var_fecha_manual.get().strip()

    def _descargar_ahora(self) -> None:
        if self._corriendo:
            return
        if not CREDENCIALES_PATH.exists():
            messagebox.showwarning("Faltan credenciales", "Configura credenciales.env antes de descargar.")
            return

        fecha = self._fecha_seleccionada()

        self._corriendo = True
        self.btn_manual.config(state="disabled", text="Descargando…")
        self._log_clear()
        self._log_linea(
            f"[{datetime.now().strftime('%H:%M:%S')}] Iniciando descarga manual del día {fecha or '(ayer, por defecto)'}…"
        )
        self._log_linea(f"Usando Python: {sys.executable}")

        args = [sys.executable, "-u", str(SCRIPT_DESCARGA)]
        if self.var_debug.get():
            args.append("--debug")
        if fecha:
            args.extend(["--fecha", fecha])

        threading.Thread(target=self._correr_proceso, args=(args,), daemon=True).start()

    def _correr_proceso(self, args: list[str]) -> None:
        try:
            proceso = subprocess.Popen(
                args,
                cwd=str(BASE_DIR),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                creationflags=CREATE_NO_WINDOW,
            )
            assert proceso.stdout is not None
            for linea in proceso.stdout:
                self._cola.put(linea.rstrip("\n"))
            proceso.wait()
            if proceso.returncode == 0:
                self._cola.put("__OK__")
            else:
                self._cola.put(f"__ERROR__:{proceso.returncode}")
        except Exception as exc:  # noqa: BLE001
            self._cola.put(f"__EXCEPCION__:{exc}")

    # -------------------------------------------------- Acción: automática --

    def _alternar_automatica(self) -> None:
        if tarea_registrada():
            self._ejecutar_ps1_elevado(quitar=True)
        else:
            hora = self.var_hora.get().strip() or "07:00"
            guardar_hora(hora)
            self._ejecutar_ps1_elevado(quitar=False, hora=hora)

    def _ejecutar_ps1_elevado(self, quitar: bool, hora: str = "07:00") -> None:
        self.btn_auto.config(state="disabled")
        accion = "Quitando" if quitar else "Activando"
        self._log_linea(
            f"[{datetime.now().strftime('%H:%M:%S')}] {accion} la descarga automática… "
            "Windows va a pedir permiso de Administrador: acepta la ventana que aparece."
        )

        if quitar:
            argumento_ps1 = f'-NoProfile -ExecutionPolicy Bypass -File "{SCRIPT_TAREA}" -Quitar'
        else:
            argumento_ps1 = f'-NoProfile -ExecutionPolicy Bypass -File "{SCRIPT_TAREA}" -Hora {hora}'

        comando = f"Start-Process powershell -Verb RunAs -Wait -ArgumentList '{argumento_ps1}'"

        def trabajo() -> None:
            try:
                subprocess.run(
                    ["powershell", "-Command", comando],
                    cwd=str(BASE_DIR),
                    creationflags=CREATE_NO_WINDOW,
                )
            except Exception as exc:  # noqa: BLE001
                self._cola.put(f"__EXCEPCION__:{exc}")
            self._cola.put("__TAREA_LISTA__")

        threading.Thread(target=trabajo, daemon=True).start()

    # -------------------------------------------------------- Log helpers --

    def _log_clear(self) -> None:
        self.texto_log.configure(state="normal")
        self.texto_log.delete("1.0", "end")
        self.texto_log.configure(state="disabled")

    def _log_linea(self, texto: str) -> None:
        self.texto_log.configure(state="normal")
        self.texto_log.insert("end", texto + "\n")
        self.texto_log.see("end")
        self.texto_log.configure(state="disabled")

    def _abrir_log(self) -> None:
        if not LOG_FILE.exists():
            messagebox.showinfo("Log", "Todavía no hay ningún log (no se ha corrido el script).")
            return
        try:
            os.startfile(str(LOG_FILE))  # type: ignore[attr-defined]
        except Exception:
            subprocess.Popen(["notepad.exe", str(LOG_FILE)])

    # --------------------------------------------- Cola del hilo de fondo --

    def _poll_cola(self) -> None:
        try:
            while True:
                item = self._cola.get_nowait()
                if item == "__OK__":
                    self._corriendo = False
                    self.btn_manual.config(state="normal", text="📥 Descargar ahora")
                    self._log_linea("✅ Descarga terminada. Revisa “Comprobantes Recibidos” en la app.")
                elif item.startswith("__ERROR__"):
                    self._corriendo = False
                    self.btn_manual.config(state="normal", text="📥 Descargar ahora")
                    codigo = item.split(":", 1)[1] if ":" in item else "?"
                    self._log_linea(f"❌ El script terminó con un error (código {codigo}). Revisa el detalle arriba.")
                elif item.startswith("__EXCEPCION__"):
                    self._corriendo = False
                    self.btn_manual.config(state="normal", text="📥 Descargar ahora")
                    self._log_linea(f"❌ No se pudo ejecutar: {item.split(':', 1)[1]}")
                elif item == "__TAREA_LISTA__":
                    self.btn_auto.config(state="normal")
                    self._refrescar_estado()
                    self._log_linea(f"[{datetime.now().strftime('%H:%M:%S')}] Estado de la tarea automatica actualizado.")
                else:
                    self._log_linea(item)
        except queue.Empty:
            pass
        self.after(150, self._poll_cola)


def main() -> None:
    if os.name != "nt":
        print("Este panel está pensado para Windows (usa el Programador de Tareas de Windows).")
    app = PanelControl()
    app.mainloop()


if __name__ == "__main__":
    main()
