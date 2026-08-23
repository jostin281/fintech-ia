@echo off
REM Este .bat es lo que registra el Programador de Tareas de Windows.
REM Se asegura de correr siempre desde esta carpeta (para que
REM credenciales.env, descargas/ y el log se ubiquen aquí sin importar
REM desde dónde lo dispare el Programador de Tareas).
cd /d "%~dp0"
python descargar_comprobantes_sri.py
