# Arranca la web de Pizzerías Huracanes en http://localhost:8080
# Uso:  clic derecho > "Ejecutar con PowerShell"  (o desde terminal: .\iniciar-web.ps1)
$ErrorActionPreference = "SilentlyContinue"
Write-Host "Sirviendo Pizzerias Huracanes en http://localhost:8080 ..." -ForegroundColor Cyan
Write-Host "(Pulsa Ctrl+C para detener)" -ForegroundColor DarkGray
Start-Process "http://localhost:8080/"
Set-Location $PSScriptRoot
python serve.py
