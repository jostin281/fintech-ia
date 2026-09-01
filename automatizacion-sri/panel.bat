@echo off
REM Abre el panel de control (ventana con botones) de la descarga de
REM comprobantes del SRI. Doble clic en este archivo para abrirlo.
cd /d "%~dp0"

where pythonw >nul 2>nul
if %errorlevel%==0 (
    start "" pythonw panel_control.py
) else (
    start "" python panel_control.py
)
