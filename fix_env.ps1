# fix_env.ps1 - Run this any time .env.local gets corrupted with UTF-16 encoding
# Usage: ./fix_env.ps1

$envFile = "C:\Users\syedy\Desktop\Anti\frontend\.env.local"
$content = Get-Content -Path $envFile -Raw

# Write back as UTF-8 without BOM
[System.IO.File]::WriteAllText($envFile, $content, [System.Text.UTF8Encoding]::new($false))

Write-Host "✅ .env.local has been re-saved as UTF-8 (no BOM)" -ForegroundColor Green
Write-Host "   Please restart your 'npm run dev' server." -ForegroundColor Cyan
