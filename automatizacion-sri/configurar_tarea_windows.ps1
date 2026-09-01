# configurar_tarea_windows.ps1
# Registra o quita la tarea de descarga diaria automatica de comprobantes
# SRI en el Programador de Tareas de Windows.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File configurar_tarea_windows.ps1                # registra, todos los dias a las 07:00
#   powershell -ExecutionPolicy Bypass -File configurar_tarea_windows.ps1 -Hora 06:30     # registra a otra hora
#   powershell -ExecutionPolicy Bypass -File configurar_tarea_windows.ps1 -Quitar         # elimina la tarea (desactiva la descarga automatica)
#
# Requiere ejecutarse como administrador (crear/quitar una tarea con
# privilegios "Highest" lo exige Windows). El panel de control
# (panel.bat / panel_control.py) ya pide esos permisos automaticamente
# al hacer clic en el boton "Activar/Desactivar descarga automatica" —
# no hace falta correr este script a mano salvo que prefieras la linea
# de comandos.

param(
    [string]$Hora = "07:00",
    [switch]$Quitar
)

$ErrorActionPreference = "Stop"

$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$batPath    = Join-Path $scriptDir "ejecutar.bat"
$taskName   = "FinTech - Descarga Comprobantes SRI"

$tareaExistente = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($Quitar) {
    if ($tareaExistente) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host "OK Tarea '$taskName' eliminada. La descarga automatica diaria quedo desactivada." -ForegroundColor Green
    } else {
        Write-Host "La tarea '$taskName' no estaba registrada (nada que quitar)." -ForegroundColor Yellow
    }
    exit 0
}

if (-not (Test-Path $batPath)) {
    Write-Error "No encontre ejecutar.bat en $scriptDir."
    exit 1
}

if ($tareaExistente) {
    Write-Host "Eliminando tarea anterior '$taskName'..."
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$accion = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c `"$batPath`"" `
    -WorkingDirectory $scriptDir

$disparador = New-ScheduledTaskTrigger -Daily -At $Hora

$configuracion = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -RestartCount 2 `
    -RestartInterval (New-TimeSpan -Minutes 5) `
    -StartWhenAvailable

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $accion `
    -Trigger $disparador `
    -Settings $configuracion `
    -RunLevel Highest `
    -Force | Out-Null

Write-Host ""
Write-Host "OK Tarea registrada exitosamente:" -ForegroundColor Green
Write-Host "   Nombre : $taskName"
Write-Host "   Hora   : todos los dias a las $Hora"
Write-Host "   Script : $batPath"
