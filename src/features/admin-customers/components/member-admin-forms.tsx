'use client';

import { KeyRound, Lock, LockOpen, Minus, Plus } from 'lucide-react';
import { useActionState, useState } from 'react';

import { buttonClass } from '@/components/ui/button';
import { useActionToast } from '@/components/ui/toast';
import { ActionForm, SubmitButton, TextField, TextareaField } from '@/components/ui/form';
import { cn } from '@/lib/cn';
import { formatPhone } from '@/lib/format';
import { initialFormState } from '@/lib/form-state';

import {
  adjustMemberPointsAction,
  resetMemberPasswordAction,
  setMemberLockedAction,
  updateMemberAction,
  type TempPasswordState,
} from '../actions';

interface MemberEditable {
  user_id: string;
  full_name: string;
  phone: string | null;
  staff_note: string | null;
  login_kind: 'phone' | 'email' | 'google';
}

export function MemberInfoForm({ member }: { member: MemberEditable }) {
  const phoneLocked = member.login_kind === 'phone';
  return (
    <ActionForm action={updateMemberAction.bind(null, member.user_id)}>
      <TextField name="full_name" label="Họ tên" defaultValue={member.full_name} required />
      {phoneLocked ? (
        <>
          <input type="hidden" name="phone" value={member.phone ?? ''} />
          <TextField
            name="phone_display"
            label="Số điện thoại (tên đăng nhập)"
            defaultValue={member.phone ? formatPhone(member.phone) : ''}
            disabled
            hint="Tài khoản đăng ký bằng SĐT: số là tên đăng nhập nên không đổi ở đây."
          />
        </>
      ) : (
        <TextField
          name="phone"
          label="Số điện thoại"
          type="tel"
          defaultValue={member.phone ? formatPhone(member.phone) : ''}
          optional
          hint="Đổi số sẽ gắn thành viên với hồ sơ khách cùng số."
        />
      )}
      <TextareaField
        name="staff_note"
        label="Ghi chú nội bộ"
        defaultValue={member.staff_note ?? ''}
        optional
        hint="Khách không nhìn thấy."
      />
      <SubmitButton size="sm">Lưu</SubmitButton>
    </ActionForm>
  );
}

export function AdjustPointsForm({ userId }: { userId: string }) {
  const [direction, setDirection] = useState<'add' | 'subtract'>('add');
  return (
    <ActionForm action={adjustMemberPointsAction.bind(null, userId)} resetOnSuccess>
      <input type="hidden" name="direction" value={direction} />
      <div role="radiogroup" aria-label="Loại điều chỉnh" className="grid grid-cols-2 gap-1 rounded-control bg-hall p-1">
        {(['add', 'subtract'] as const).map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={direction === d}
            onClick={() => setDirection(d)}
            className={cn(
              'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[0.4rem] text-sm font-medium',
              direction === d ? (d === 'add' ? 'bg-court-strong text-paper' : 'bg-shuttle-deep text-paper') : 'text-muted hover:text-ink',
            )}
          >
            {d === 'add' ? <Plus className="size-4" aria-hidden /> : <Minus className="size-4" aria-hidden />}
            {d === 'add' ? 'Cộng điểm' : 'Trừ điểm'}
          </button>
        ))}
      </div>
      <TextField name="amount" label="Số điểm" type="number" inputMode="numeric" min={1} max={100000} required />
      <TextField name="reason" label="Lý do" placeholder="Ví dụ: tặng điểm sinh nhật" required maxLength={200} />
      <SubmitButton size="sm" variant={direction === 'add' ? 'brand' : 'danger'}>
        {direction === 'add' ? 'Cộng điểm' : 'Trừ điểm'}
      </SubmitButton>
    </ActionForm>
  );
}

export function MemberLockButton({ userId, locked }: { userId: string; locked: boolean }) {
  const [state, action, pending] = useActionState(setMemberLockedAction.bind(null, userId, !locked), initialFormState);
  useActionToast(state);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!locked && !window.confirm('Khóa tài khoản này? Khách sẽ không đăng nhập được cho tới khi mở khóa.')) e.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <button type="submit" disabled={pending} className={buttonClass(locked ? 'outline' : 'danger', 'sm', 'w-full')}>
        {locked ? <LockOpen className="size-4" aria-hidden /> : <Lock className="size-4" aria-hidden />}
        {pending ? 'Đang lưu…' : locked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
      </button>
    </form>
  );
}

const initialTemp: TempPasswordState = { status: 'idle' };

export function TempPasswordButton({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(resetMemberPasswordAction.bind(null, userId), initialTemp);
  useActionToast(state);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm('Cấp mật khẩu tạm mới? Mật khẩu hiện tại của khách sẽ không dùng được nữa.')) e.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <button type="submit" disabled={pending} className={buttonClass('outline', 'sm', 'w-full')}>
        <KeyRound className="size-4" aria-hidden />
        {pending ? 'Đang cấp…' : 'Cấp mật khẩu tạm'}
      </button>
      {state.tempPassword && (
        <div className="rounded-control border border-court bg-court-soft p-3 text-sm">
          <p className="text-court-deep">Mật khẩu tạm (chỉ hiện một lần):</p>
          <p className="mt-1 font-mono text-xl font-semibold tracking-wider select-all">{state.tempPassword}</p>
        </div>
      )}
      {state.message && (
        <p role="status" className={cn('text-sm', state.status === 'error' ? 'text-shuttle-deep' : 'text-muted')}>
          {state.message}
        </p>
      )}
    </form>
  );
}
