#!/bin/sh
set -e

echo "[SRI-Automation] Iniciando contenedor de automatización SRI..."

# Si la variable RUN_ONCE está activada ("true"), ejecuta una vez y finaliza.
if [ "$RUN_ONCE" = "true" ]; then
    echo "[SRI-Automation] Ejecutando sincronización de descarga SRI única (RUN_ONCE=true)..."
    exec python descargar_comprobantes_sri.py
fi

# Modo por defecto: Ejecución continua por intervalo (por defecto 12 horas)
INTERVAL_HOURS=${RUN_INTERVAL_HOURS:-12}
INTERVAL_SECONDS=$((INTERVAL_HOURS * 3600))

echo "[SRI-Automation] Modo daemon activo. Intervalo de ejecución: cada $INTERVAL_HOURS hora(s)."

while true; do
    if [ "$RUN_ON_STARTUP" != "false" ]; then
        echo "[$(date)] [SRI-Automation] Iniciando descarga e importación de comprobantes SRI..."
        python descargar_comprobantes_sri.py || echo "[$(date)] [SRI-Automation] Finalizó la ejecución del script con advertencias o error."
    else
        echo "[SRI-Automation] Omitiendo ejecución inicial al arranque (RUN_ON_STARTUP=false)."
        RUN_ON_STARTUP="true"
    fi
    echo "[$(date)] [SRI-Automation] Esperando $INTERVAL_HOURS hora(s) ($INTERVAL_SECONDS segundos) hasta el siguiente ciclo..."
    sleep $INTERVAL_SECONDS
done
