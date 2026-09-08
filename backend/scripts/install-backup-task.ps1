$projectPath = Split-Path -Parent $PSScriptRoot
$action = New-ScheduledTaskAction -Execute "npm.cmd" -Argument "run backup" -WorkingDirectory $projectPath
$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
Register-ScheduledTask -TaskName "EJB Manager - Respaldo diario" -Action $action -Trigger $trigger -Description "Respaldo diario PostgreSQL de EJB MANAGER" -Force
