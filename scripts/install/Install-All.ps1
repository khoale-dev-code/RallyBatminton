<#
.SYNOPSIS
  Rally Badminton — cài toàn bộ dự án theo thứ tự cụm 01 → 06, rồi chuẩn bị môi trường chạy.

.DESCRIPTION
  1. Kiểm tra Node.js (>= 20.9).
  2. Chạy lần lượt các cụm: Nền tảng, Database, Website khách, Quản trị lõi, Hàng hóa, Nhân sự.
     Dừng ngay nếu một cụm có file xung đột (chạy lại với -Force để ghi đè có sao lưu).
  3. Tạo .env.local từ .env.example nếu chưa có (không bao giờ ghi đè .env.local đang có).
  4. Chạy npm install (bỏ qua bằng -SkipNpmInstall).

.PARAMETER ProjectRoot
  Thư mục dự án. Mặc định: D:\freetime\rally

.PARAMETER DryRun
  Chỉ in kế hoạch của mọi cụm, không ghi gì, không chạy npm.

.PARAMETER Force
  Cho phép ghi đè file đang khác nội dung (bản cũ được sao lưu, rollback theo từng cụm).

.PARAMETER SkipNpmInstall
  Không chạy npm install.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\install\Install-All.ps1 -DryRun
  powershell -ExecutionPolicy Bypass -File .\scripts\install\Install-All.ps1 -ProjectRoot D:\freetime\rally
#>
[CmdletBinding()]
param(
  [string]$ProjectRoot = 'D:\freetime\rally',
  [switch]$DryRun,
  [switch]$Force,
  [switch]$SkipNpmInstall
)

. (Join-Path $PSScriptRoot '_RallyInstaller.ps1')
. (Join-Path $PSScriptRoot '_RallyClusters.ps1')

$root = [System.IO.Path]::GetFullPath($ProjectRoot)
Write-RallyStep '=== Rally Badminton: cài toàn bộ dự án ===' 'Cyan'

# 1. Node.js -------------------------------------------------------------------
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-RallyStep 'Chưa cài Node.js. Tải bản LTS tại https://nodejs.org rồi chạy lại.' 'Yellow'
  if (-not $DryRun) { exit 1 }
}
else {
  $version = (& node -v).Trim().TrimStart('v')
  $parts = $version.Split('.')
  $ok = ([int]$parts[0] -gt 20) -or ([int]$parts[0] -eq 20 -and [int]$parts[1] -ge 9)
  if ($ok) { Write-RallyStep "Node.js $version" 'Green' }
  else {
    Write-RallyStep "Node.js $version quá cũ — cần 20.9 trở lên." 'Yellow'
    if (-not $DryRun) { exit 1 }
  }
}

# 2. Các cụm --------------------------------------------------------------------
foreach ($key in $RallyClusters.Keys) {
  $cluster = $RallyClusters[$key]
  Write-RallyStep ''
  $code = Invoke-RallyCluster -Key $key -Name $cluster.Name -Include $cluster.Include -ProjectRoot $root -DryRun:$DryRun -Force:$Force
  if ($code -ne 0) {
    Write-RallyStep "Dừng ở cụm $key. Các cụm trước đã cài xong; xử lý xung đột rồi chạy lại." 'Yellow'
    exit $code
  }
}

# 3. .env.local -------------------------------------------------------------------
Write-RallyStep ''
$envLocal = Join-Path $root '.env.local'
$envExample = Join-Path $root '.env.example'
if (Test-Path -LiteralPath $envLocal) {
  Write-RallyStep '.env.local đã có — giữ nguyên.' 'DarkGray'
}
elseif ($DryRun) {
  Write-RallyStep 'DryRun: sẽ tạo .env.local từ .env.example.' 'Yellow'
}
elseif (Test-Path -LiteralPath $envExample) {
  Copy-Item -LiteralPath $envExample -Destination $envLocal
  Write-RallyStep 'Đã tạo .env.local — mở file và điền khóa Supabase trước khi chạy.' 'Green'
}

# 4. npm install ------------------------------------------------------------------
if ($DryRun -or $SkipNpmInstall) {
  Write-RallyStep 'Bỏ qua npm install.' 'DarkGray'
}
else {
  Write-RallyStep 'Đang chạy npm install…' 'Cyan'
  Push-Location $root
  try {
    & npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm install lỗi (mã $LASTEXITCODE)" }
  }
  finally { Pop-Location }
}

Write-RallyStep ''
Write-RallyStep 'Bước tiếp theo:' 'Cyan'
Write-RallyStep '  1. Supabase SQL Editor: chạy supabase\sql\00 → 01 → 02 (03, 04 tùy chọn).'
Write-RallyStep "  2. Authentication > Add user cho chủ sân, rồi: select private.bootstrap_first_owner('email', 'Tên');"
Write-RallyStep '  3. Điền .env.local (URL, publishable key, secret key, site URL, Turnstile).'
Write-RallyStep "  4. cd `"$root`"; npm run dev  →  http://localhost:3000"
Write-RallyStep '  Chi tiết: README.md' 'DarkGray'
exit 0
