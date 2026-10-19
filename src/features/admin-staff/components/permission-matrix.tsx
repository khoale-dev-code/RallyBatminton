import { ActionForm, SubmitButton } from '@/components/ui/form';
import { Disclosure } from '@/components/ui/primitives';
import { PERMISSION_GROUPS, type AppPermission } from '@/lib/auth/permissions';
import { type FormState } from '@/lib/form-state';

interface PermissionMatrixProps {
  branches: Array<{ id: string; name: string }>;
  granted: Array<{ branch_id: string; permission: AppPermission }>;
  actionFor: (branchId: string) => (prev: FormState, formData: FormData) => Promise<FormState>;
}

/** Quyền theo từng chi nhánh. Quyền tiên quyết (ví dụ "Xem lịch") được database tự thêm. */
export function PermissionMatrix({ branches, granted, actionFor }: PermissionMatrixProps) {
  return (
    <ul className="flex flex-col gap-3">
      {branches.map((b) => {
        const mine = new Set(granted.filter((g) => g.branch_id === b.id).map((g) => g.permission));
        return (
          <li key={b.id}>
            <Disclosure
              summary={
                <span className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">{b.name}</span>
                  <span className="text-sm text-muted">{mine.size === 0 ? 'Không có quyền' : `${mine.size} quyền`}</span>
                </span>
              }
            >
              <ActionForm action={actionFor(b.id)} className="gap-5">
                {/* key theo quyền hiện có: sau khi lưu, ô tick cập nhật cả quyền database tự thêm. */}
                <div key={[...mine].sort().join(',')} className="flex flex-col gap-5">
                  {PERMISSION_GROUPS.map((group) => (
                    <fieldset key={group.title} className="flex flex-col gap-3">
                      <legend className="mb-1 text-sm font-medium text-muted">{group.title}</legend>
                      {group.items.map((item) => (
                        <label key={item.key} className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            name="permissions"
                            value={item.key}
                            defaultChecked={mine.has(item.key)}
                            className="mt-1 size-4 shrink-0 accent-ink"
                          />
                          <span className="flex flex-col">
                            <span>{item.label}</span>
                            <span className="text-sm text-muted">{item.hint}</span>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  ))}
                </div>
                <SubmitButton size="sm">Lưu quyền tại {b.name}</SubmitButton>
              </ActionForm>
            </Disclosure>
          </li>
        );
      })}
    </ul>
  );
}
