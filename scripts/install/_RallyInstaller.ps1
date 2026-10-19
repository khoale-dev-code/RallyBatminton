<#
  Thư viện dùng chung cho các script Install-*.ps1 (được dot-source, không chạy trực tiếp).
  - Nguồn: thư mục gói (cha của scripts\install).
  - Mỗi cụm khai báo danh sách mẫu đường dẫn; hàm Invoke-RallyCluster lập kế hoạch,
    phát hiện xung đột, sao lưu, ghi file, kiểm tra SHA-256 và ghi manifest để rollback.
#>

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$script:RallyPackageRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$script:Sep = [System.IO.Path]::DirectorySeparatorChar

function Write-RallyStep {
  param([string]$Message, [string]$Color = 'Gray')
  Write-Host $Message -ForegroundColor $Color
}

function ConvertTo-RallyRelative {
  param([string]$FullPath, [string]$Root)
  $rel = $FullPath.Substring($Root.Length).TrimStart('\', '/')
  return ($rel -replace '\\', '/')
}

function Test-RallyMatch {
  <# Mẫu dùng '/', hỗ trợ '**' (mọi cấp thư mục) và '*' (trong một cấp). #>
  param([string]$RelPath, [string]$Pattern)
  $regex = '^' + ([regex]::Escape($Pattern) -replace '\\\*\\\*', '.*' -replace '\\\*', '[^/]*') + '$'
  return $RelPath -match $regex
}

function Get-RallyClusterFiles {
  param([string[]]$Include, [string[]]$Exclude = @())
  $root = $script:RallyPackageRoot
  $skipDirs = @('node_modules', '.next', '.git', '.rally-backups')
  $all = Get-ChildItem -LiteralPath $root -Recurse -File -Force | Where-Object {
    $rel = ConvertTo-RallyRelative $_.FullName $root
    $top = ($rel -split '/')[0]
    -not ($skipDirs -contains $top) -and $rel -notmatch '(^|/)\.env\.local$' -and $rel -notmatch '\.tsbuildinfo$'
  }
  $result = @()
  foreach ($file in $all) {
    $rel = ConvertTo-RallyRelative $file.FullName $root
    $included = $false
    foreach ($p in $Include) { if (Test-RallyMatch $rel $p) { $included = $true; break } }
    if (-not $included) { continue }
    foreach ($p in $Exclude) { if (Test-RallyMatch $rel $p) { $included = $false; break } }
    if ($included) { $result += $rel }
  }
  return @($result | Sort-Object)
}

function Get-RallySha256 {
  param([string]$Path)
  return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash
}

function New-RallyDirectory {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { New-Item -ItemType Directory -Path $Path -Force | Out-Null }
}

function Invoke-RallyRollback {
  param([string]$BackupDir, [switch]$DryRun)
  $manifestPath = Join-Path $BackupDir 'manifest.json'
  if (-not (Test-Path -LiteralPath $manifestPath)) { throw "Không tìm thấy manifest: $manifestPath" }
  $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
  Write-RallyStep "Khôi phục cụm '$($manifest.cluster)' từ: $BackupDir" 'Yellow'
  foreach ($entry in @($manifest.files)) {
    $nativeRel = $entry.path -replace '/', $script:Sep
    $target = Join-Path $manifest.projectRoot $nativeRel
    if ($entry.action -eq 'created') {
      Write-RallyStep ("  [xóa file đã tạo] " + $entry.path)
      if (-not $DryRun -and (Test-Path -LiteralPath $target)) { Remove-Item -LiteralPath $target -Force }
    }
    elseif ($entry.action -eq 'replaced') {
      Write-RallyStep ("  [trả bản cũ]      " + $entry.path)
      if (-not $DryRun) {
        New-RallyDirectory (Split-Path -Parent $target)
        Copy-Item -LiteralPath (Join-Path $BackupDir $nativeRel) -Destination $target -Force
      }
    }
  }
  if ($DryRun) { Write-RallyStep 'DryRun: chưa thay đổi gì.' 'Yellow' } else { Write-RallyStep 'Đã khôi phục.' 'Green' }
}

function Invoke-RallyCluster {
  <#
    Trả về mã thoát: 0 = xong/không có gì để làm, 2 = có xung đột (cần -Force).
  #>
  param(
    [Parameter(Mandatory)] [string]$Key,
    [Parameter(Mandatory)] [string]$Name,
    [Parameter(Mandatory)] [string[]]$Include,
    [string[]]$Exclude = @(),
    [Parameter(Mandatory)] [string]$ProjectRoot,
    [switch]$DryRun,
    [switch]$Force,
    [string]$RollbackFrom
  )
  Write-RallyStep "=== Rally Badminton: $Name ===" 'Cyan'
  if ($RollbackFrom) { Invoke-RallyRollback -BackupDir $RollbackFrom -DryRun:$DryRun; return 0 }

  $source = $script:RallyPackageRoot
  $root = [System.IO.Path]::GetFullPath($ProjectRoot)
  Write-RallyStep "Nguồn : $source"
  Write-RallyStep "Đích  : $root"
  if ($DryRun) { Write-RallyStep 'Chế độ: DRY RUN (không ghi file)' 'Yellow' }

  $files = Get-RallyClusterFiles -Include $Include -Exclude $Exclude
  if ($files.Count -eq 0) { throw "Gói cài đặt thiếu file của cụm '$Name'. Hãy giải nén đầy đủ." }

  if ($source.TrimEnd('\', '/') -eq $root.TrimEnd('\', '/')) {
    Write-RallyStep "Gói đã nằm sẵn trong thư mục dự án ($($files.Count) file). Không cần chép." 'Green'
    return 0
  }

  $plan = @()
  foreach ($rel in $files) {
    $nativeRel = $rel -replace '/', $script:Sep
    $src = Join-Path $source $nativeRel
    $dst = Join-Path $root $nativeRel
    $action = 'create'
    if (Test-Path -LiteralPath $dst) {
      if ((Get-RallySha256 $src) -eq (Get-RallySha256 $dst)) { $action = 'unchanged' } else { $action = 'conflict' }
    }
    $plan += [pscustomobject]@{ Path = $rel; NativePath = $nativeRel; Action = $action; Source = $src; Target = $dst }
  }

  $create = @($plan | Where-Object { $_.Action -eq 'create' })
  $same = @($plan | Where-Object { $_.Action -eq 'unchanged' })
  $conflicts = @($plan | Where-Object { $_.Action -eq 'conflict' })
  Write-RallyStep ''
  Write-RallyStep ("Kế hoạch: {0} tạo mới, {1} giống hệt, {2} khác nội dung" -f $create.Count, $same.Count, $conflicts.Count) 'Cyan'
  foreach ($item in $create) { Write-RallyStep ("  [tạo mới]   " + $item.Path) 'Green' }
  foreach ($item in $conflicts) { Write-RallyStep ("  [XUNG ĐỘT]  " + $item.Path) 'Yellow' }

  if ($conflicts.Count -gt 0 -and -not $Force) {
    Write-RallyStep ''
    Write-RallyStep "Có $($conflicts.Count) file đang khác nội dung. Kiểm tra lại rồi chạy thêm -Force để ghi đè (bản cũ được sao lưu)." 'Yellow'
    return 2
  }
  $toWrite = @($create + $conflicts)
  if ($toWrite.Count -eq 0) { Write-RallyStep 'Mọi file đã cập nhật.' 'Green'; return 0 }
  if ($DryRun) { Write-RallyStep "DryRun: sẽ ghi $($toWrite.Count) file." 'Yellow'; return 0 }

  $stamp = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + $Key
  $backupDir = Join-Path $root (Join-Path '.rally-backups' $stamp)
  New-RallyDirectory $backupDir
  $entries = @()
  try {
    foreach ($item in $toWrite) {
      New-RallyDirectory (Split-Path -Parent $item.Target)
      if ($item.Action -eq 'conflict') {
        $backupFile = Join-Path $backupDir $item.NativePath
        New-RallyDirectory (Split-Path -Parent $backupFile)
        Copy-Item -LiteralPath $item.Target -Destination $backupFile -Force
        $entries += [ordered]@{ path = $item.Path; action = 'replaced' }
      }
      else {
        $entries += [ordered]@{ path = $item.Path; action = 'created' }
      }
      Copy-Item -LiteralPath $item.Source -Destination $item.Target -Force
      if ((Get-RallySha256 $item.Source) -ne (Get-RallySha256 $item.Target)) { throw "Sao chép lỗi (SHA-256 khác): $($item.Path)" }
    }
  }
  catch {
    Write-RallyStep "LỖI: $($_.Exception.Message)" 'Red'
    Write-RallyStep 'Đang hoàn tác các file đã ghi trong lần chạy này…' 'Yellow'
    [ordered]@{ createdAt = (Get-Date).ToString('o'); cluster = $Name; projectRoot = $root; files = $entries } |
      ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $backupDir 'manifest.json') -Encoding UTF8
    Invoke-RallyRollback -BackupDir $backupDir
    throw
  }
  [ordered]@{ createdAt = (Get-Date).ToString('o'); cluster = $Name; projectRoot = $root; files = $entries } |
    ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $backupDir 'manifest.json') -Encoding UTF8
  Write-RallyStep "Đã ghi $($toWrite.Count) file. Rollback: -RollbackFrom `"$backupDir`"" 'Green'
  return 0
}
