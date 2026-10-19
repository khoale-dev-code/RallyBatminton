<#
.SYNOPSIS
  Rally Badminton — cài cụm hàng hóa: danh mục, biến thể, tồn kho, bán hàng tại quầy, đơn bán, cho thuê

.DESCRIPTION
  Chép các file của cụm từ gói này vào thư mục dự án.
  - File chưa có       -> tạo mới.
  - File giống hệt     -> bỏ qua.
  - File khác nội dung -> XUNG ĐỘT: dừng lại, trừ khi thêm -Force
                          (khi -Force: sao lưu bản cũ vào .rally-backups\<thời điểm>\ rồi ghi đè).
  Mỗi lần ghi tạo manifest.json để rollback. Script không chạy SQL, không đọc/ghi .env.local.

.PARAMETER ProjectRoot
  Thư mục dự án. Mặc định: D:\freetime\rally

.PARAMETER DryRun
  Chỉ in kế hoạch, không ghi gì.

.PARAMETER Force
  Cho phép ghi đè file đang khác nội dung (có sao lưu trước).

.PARAMETER RollbackFrom
  Thư mục backup của một lần cài (vd. D:\freetime\rally\.rally-backups\20261017-120000-...) để trả lại như trước.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\Install-05-Retail.ps1 -DryRun
  powershell -ExecutionPolicy Bypass -File .\Install-05-Retail.ps1 -ProjectRoot D:\freetime\rally
#>
[CmdletBinding()]
param(
  [string]$ProjectRoot = 'D:\freetime\rally',
  [switch]$DryRun,
  [switch]$Force,
  [string]$RollbackFrom
)

. (Join-Path $PSScriptRoot '_RallyInstaller.ps1')
. (Join-Path $PSScriptRoot '_RallyClusters.ps1')

$cluster = $RallyClusters['05-Retail']
$code = Invoke-RallyCluster -Key $cluster.Key -Name $cluster.Name -Include $cluster.Include -ProjectRoot $ProjectRoot -DryRun:$DryRun -Force:$Force -RollbackFrom $RollbackFrom
exit $code
