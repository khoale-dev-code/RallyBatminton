'use client';

import { TicketPlus } from 'lucide-react';
import { useState } from 'react';

import { ActionForm, CheckboxField, PasswordField, SubmitButton, TextField } from '@/components/ui/form';
import { formatPhone } from '@/lib/format';

import { changeMemberPasswordAction, claimBookingAction, updateMemberProfileAction } from '../actions';
import { type MemberProfile } from '../schemas';

import { StrengthMeter } from './auth-forms';

/** Thêm đơn đặt lúc chưa đăng nhập: cần đúng mã đơn + SĐT đã dùng khi đặt. */
export function ClaimBookingForm({ defaultPhone }: { defaultPhone: string | null }) {
  return (
    <ActionForm action={claimBookingAction} resetOnSuccess className="gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <TextField
          name="code"
          label="Mã đơn"
          placeholder="RB-XXXXXXXX"
          autoCapitalize="characters"
          autoComplete="off"
          className="font-display text-lg tracking-wider uppercase placeholder:normal-case"
          required
        />
        <TextField
          name="phone"
          label="SĐT đã dùng khi đặt"
          type="tel"
          inputMode="tel"
          defaultValue={defaultPhone ? formatPhone(defaultPhone) : ''}
          required
        />
        <SubmitButton variant="primary" pendingLabel="Đang thêm…" className="min-h-11">
          <TicketPlus className="size-4" aria-hidden />
          Thêm đơn
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ProfileForm({ profile }: { profile: MemberProfile }) {
  const phoneLocked = profile.login_kind === 'phone';
  return (
    <ActionForm action={updateMemberProfileAction}>
      <TextField name="full_name" label="Họ và tên" defaultValue={profile.full_name} autoComplete="name" required />
      {phoneLocked ? (
        <>
          <input type="hidden" name="phone" value={profile.phone ?? ''} />
          <TextField
            name="phone_display"
            label="Số điện thoại (tên đăng nhập)"
            defaultValue={profile.phone ? formatPhone(profile.phone) : ''}
            disabled
            hint="Muốn đổi số đăng nhập, vui lòng liên hệ quầy hoặc hotline."
          />
        </>
      ) : (
        <TextField
          name="phone"
          label="Số điện thoại"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          defaultValue={profile.phone ? formatPhone(profile.phone) : ''}
          optional
          hint="Dùng để đăng nhập bằng SĐT và tự điền khi đặt sân."
        />
      )}
      {profile.email && <TextField name="email_display" label="Email" defaultValue={profile.email} disabled />}
      <CheckboxField name="marketing_opt_in" label="Nhận tin ưu đãi dành cho thành viên" defaultChecked={profile.marketing_opt_in} />
      <SubmitButton variant="primary" pendingLabel="Đang lưu…" className="self-start">
        Lưu hồ sơ
      </SubmitButton>
    </ActionForm>
  );
}

export function MemberPasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [password, setPassword] = useState('');
  return (
    <ActionForm action={changeMemberPasswordAction} resetOnSuccess>
      {hasPassword && <PasswordField name="current" label="Mật khẩu hiện tại" autoComplete="current-password" required />}
      <div className="flex flex-col gap-2">
        <PasswordField
          name="password"
          label={hasPassword ? 'Mật khẩu mới' : 'Tạo mật khẩu'}
          autoComplete="new-password"
          required
          onChange={(e) => setPassword(e.currentTarget.value)}
        />
        <StrengthMeter value={password} />
      </div>
      <PasswordField name="confirm" label="Nhập lại mật khẩu" autoComplete="new-password" required />
      <SubmitButton variant="primary" pendingLabel="Đang lưu…" className="self-start">
        {hasPassword ? 'Đổi mật khẩu' : 'Tạo mật khẩu'}
      </SubmitButton>
    </ActionForm>
  );
}
