<#
.SYNOPSIS
  Registra ou remove a tarefa agendada do Painel de Postagens no Windows Task Scheduler.

.PARAMETER Unregister
  Remove a tarefa em vez de registrá-la.

.PARAMETER Minutes
  Intervalo entre execuções em minutos (padrão 30).

.PARAMETER TaskName
  Nome da tarefa (padrão "PainelPostagens-Scheduler").

.EXAMPLE
  pwsh scripts\register-task.ps1
  pwsh scripts\register-task.ps1 -Minutes 15
  pwsh scripts\register-task.ps1 -Unregister
#>
[CmdletBinding()]
param(
  [switch]$Unregister,
  [int]$Minutes = 30,
  [string]$TaskName = "PainelPostagens-Scheduler"
)

$ErrorActionPreference = "Stop"

$painelDir = Split-Path -Parent $PSScriptRoot
$painelDir = (Resolve-Path $painelDir).Path

if ($Unregister) {
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removida: $TaskName"
  } else {
    Write-Host "Tarefa $TaskName não existe."
  }
  return
}

$npm = (Get-Command npm -ErrorAction Stop).Source
$action = New-ScheduledTaskAction -Execute $npm -Argument "run scheduler" -WorkingDirectory $painelDir
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes $Minutes) -RepetitionDuration ([TimeSpan]::MaxValue)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -LogonType S4U -RunLevel Limited

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Set-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal | Out-Null
  Write-Host "Atualizada: $TaskName (a cada $Minutes min, em $painelDir)"
} else {
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal | Out-Null
  Write-Host "Registrada: $TaskName (a cada $Minutes min, em $painelDir)"
}
