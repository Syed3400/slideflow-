# Generates a secure INTERNAL_SERVICE_TOKEN for production .env
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$token = [Convert]::ToBase64String($bytes) -replace '\+','-' -replace '/','_' -replace '=',''

Write-Host "Add to .env (use the SAME value on frontend, backend, and celery):" -ForegroundColor Green
Write-Host "INTERNAL_SERVICE_TOKEN=$token"
