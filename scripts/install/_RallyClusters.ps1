<#
  Danh sách cụm chức năng và các file thuộc cụm (mẫu đường dẫn tương đối, dấu '/').
  Mỗi file trong gói thuộc đúng MỘT cụm.
#>

$script:RallyClusters = [ordered]@{
  '01-Foundation' = @{
    Key     = '01-Foundation'
    Name    = '01 Nền tảng (cấu hình, thư viện, giao diện cơ sở)'
    Include = @(
      'package.json', 'package-lock.json', 'tsconfig.json', 'next.config.ts', 'postcss.config.mjs',
      'eslint.config.mjs', 'vitest.config.mts', '.prettierrc.json', '.prettierignore', '.gitignore',
      '.env.example', 'README.md', 'scripts/**',
      'src/proxy.ts', 'src/lib/**', 'src/components/**', 'src/hooks/**',
      'src/app/layout.tsx', 'src/app/globals.css', 'src/app/icon.svg', 'src/app/not-found.tsx', 'src/app/robots.ts'
    )
  }
  '02-Database' = @{
    Key     = '02-Database'
    Name    = '02 Database Supabase (SQL migration, kiểm tra, tài liệu)'
    Include = @('supabase/**', 'docs/**')
  }
  '03-PublicSite' = @{
    Key     = '03-PublicSite'
    Name    = '03 Website khách (chi nhánh, đặt sân, đồ uống, thuê)'
    Include = @(
      'src/app/(site)/**',
      'src/features/brand/**', 'src/features/branches/**', 'src/features/booking/**', 'src/features/catalog/**'
    )
  }
  '04-AdminCore' = @{
    Key     = '04-AdminCore'
    Name    = '04 Quản trị lõi (đăng nhập, chi nhánh, sân, giá, lịch đặt sân, khách)'
    Include = @(
      'src/app/(auth)/**',
      'src/app/admin/layout.tsx', 'src/app/admin/page.tsx', 'src/app/admin/error.tsx', 'src/app/admin/loading.tsx',
      'src/app/admin/denied/**', 'src/app/admin/password/**', 'src/app/admin/branches/**', 'src/app/admin/courts/**',
      'src/app/admin/bookings/**', 'src/app/admin/customers/**', 'src/app/admin/settings/**', 'src/app/admin/audit/**',
      'src/features/auth/**', 'src/features/admin-shell/**', 'src/features/dashboard/**', 'src/features/admin-branches/**',
      'src/features/admin-bookings/**', 'src/features/admin-customers/**', 'src/features/settings/**', 'src/features/audit/**'
    )
  }
  '05-Retail' = @{
    Key     = '05-Retail'
    Name    = '05 Hàng hóa (quản lý sản phẩm, tồn kho, bán hàng, cho thuê)'
    Include = @(
      'src/app/admin/catalog/**', 'src/app/admin/inventory/**', 'src/app/admin/pos/**', 'src/app/admin/sales/**',
      'src/app/admin/rentals/**',
      'src/features/admin-catalog/**', 'src/features/admin-inventory/**', 'src/features/pos/**', 'src/features/admin-sales/**',
      'src/features/admin-rentals/**'
    )
  }
  '06-HR' = @{
    Key     = '06-HR'
    Name    = '06 Nhân sự (nhân viên, quyền, lịch ca, chấm công QR, bảng lương)'
    Include = @(
      'src/app/(staff)/**',
      'src/app/admin/staff/**', 'src/app/admin/shifts/**', 'src/app/admin/attendance/**', 'src/app/admin/payroll/**',
      'src/app/admin/me/**',
      'src/features/admin-staff/**', 'src/features/shifts/**', 'src/features/attendance/**', 'src/features/payroll/**',
      'src/features/me/**'
    )
  }
}
