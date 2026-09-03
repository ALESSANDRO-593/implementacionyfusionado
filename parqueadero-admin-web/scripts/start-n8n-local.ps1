$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$n8nDataRoot = Join-Path $projectRoot '.n8n-local'
$jwtSecretPath = Join-Path $n8nDataRoot 'jwt-secret.txt'

New-Item -ItemType Directory -Force -Path $n8nDataRoot | Out-Null

if (-not (Test-Path -LiteralPath $jwtSecretPath)) {
  $randomBytes = New-Object byte[] 32
  $randomGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $randomGenerator.GetBytes($randomBytes)
  }
  finally {
    $randomGenerator.Dispose()
  }

  $jwtSecret = [BitConverter]::ToString($randomBytes).Replace('-', '').ToLowerInvariant()
  Set-Content -LiteralPath $jwtSecretPath -Value $jwtSecret -NoNewline
}

$env:N8N_USER_FOLDER = $n8nDataRoot
$env:N8N_HOST = 'localhost'
$env:N8N_PORT = '5678'
$env:N8N_PROTOCOL = 'http'
$env:N8N_SECURE_COOKIE = 'false'
$env:GENERIC_TIMEZONE = 'America/Guayaquil'
$env:TZ = 'America/Guayaquil'
$env:N8N_DIAGNOSTICS_ENABLED = 'false'
$env:N8N_VERSION_NOTIFICATIONS_ENABLED = 'false'
$env:N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS = 'false'
$env:N8N_BLOCK_ENV_ACCESS_IN_NODE = 'false'
$env:NODE_FUNCTION_ALLOW_BUILTIN = 'crypto'
$env:JWT_SECRET = (Get-Content -LiteralPath $jwtSecretPath -Raw).Trim()

Set-Location -LiteralPath $projectRoot
npx --yes n8n@2.33.5 start
