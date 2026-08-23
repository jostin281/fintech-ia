# configurar_tarea_windows.ps1
# Registra la descarga diaria de comprobantes SRI en el Programador de Tareas
# de Windows para que corra automaticamente todos los dias a las 7:00 AM.

$ErrorActionPreference = "Stop"

$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$batPath    = Join-Path $scriptDir "ejecutar.bat"
$taskName   = "FinTech - Descarga Comprobantes SRI"
$hora       = "07:00"   # Cambia aqui la hora de ejecucion diaria (formato HH:MM)

if (-not (Test-Path $batPath)) {
    Write-Error "No encontre ejecutar.bat en $scriptDir."
    exit 1
}

$tareaExistente = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($tareaExistente) {
    Write-Host "Eliminando tarea anterior '$taskName'..."
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$accion = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c `"$batPath`"" `
    -WorkingDirectory $scriptDir

$disparador = New-ScheduledTaskTrigger -Daily -At $hora

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
Write-Host "   Hora   : todos los dias a las $hora"
Write-Host "   Script : $batPath"
