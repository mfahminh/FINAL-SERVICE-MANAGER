# Enable LAN access via Windows Firewall
#Requires -RunAsAdministrator
param(
  [int]$PortBackend  = 8001,
  [int]$PortFrontend = 3000
)

$ErrorActionPreference = "Stop"

$rules = @(
  @{ Name = "ServiceHP-Backend";  Port = $PortBackend },
  @{ Name = "ServiceHP-Frontend"; Port = $PortFrontend }
)

foreach ($r in $rules) {
  $existing = Get-NetFirewallRule -DisplayName $r.Name -ErrorAction SilentlyContinue
  if ($existing) { Remove-NetFirewallRule -DisplayName $r.Name }
  New-NetFirewallRule -DisplayName $r.Name `
    -Direction Inbound -Action Allow -Protocol TCP -LocalPort $r.Port `
    -Profile Any -Enabled True | Out-Null
  Write-Host "Firewall rule added: $($r.Name) TCP $($r.Port)" -ForegroundColor Green
}

# Show LAN IP addresses so user tahu URL untuk device lain
Write-Host "`nApp bisa diakses dari device lain di LAN via:" -ForegroundColor Cyan
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notmatch "^(127\.|169\.)" -and $_.PrefixOrigin -in @("Dhcp","Manual") } |
  ForEach-Object { Write-Host "  http://$($_.IPAddress):$PortFrontend" -ForegroundColor Yellow }
