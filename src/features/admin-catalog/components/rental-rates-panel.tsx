import { ActionButton } from '@/components/ui/action-button';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { ActionForm, SelectField, SubmitButton, TextField } from '@/components/ui/form';
import { Badge, Disclosure } from '@/components/ui/primitives';
import { formatRateLabel, formatVnd } from '@/lib/format';
import { RENTAL_RATE_KINDS, rentalRateKind } from '@/lib/labels';
import { autoBlockPrice, describePolicy } from '@/lib/rental-fee';
import { type Tables } from '@/lib/supabase/database.types';

import { addRentalRateAction, toggleRentalRateAction, updateRentalRateAction } from '../actions';

type Rate = Pick<
  Tables<'rental_rates'>,
  | 'id'
  | 'label'
  | 'duration_minutes'
  | 'price'
  | 'is_active'
  | 'usage'
  | 'billing'
  | 'grace_minutes'
  | 'overtime_block_minutes'
  | 'overtime_block_price'
  | 'overtime_cap'
>;

const KIND_OPTIONS = RENTAL_RATE_KINDS.map((k) => ({ value: k.value, label: k.label }));

/** Các ô của một gói giá (thêm mới hoặc sửa). Ô chính sách để trống = mặc định theo hình thức. */
function RateFields({ rate }: { rate?: Rate }) {
  const kind = rate ? rentalRateKind(rate.usage, rate.billing).value : RENTAL_RATE_KINDS[0].value;
  return (
    <>
      <SelectField name="kind" label="Hình thức" defaultValue={kind} options={KIND_OPTIONS} />
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField name="label" label="Tên gói" placeholder="1 giờ, Hết trận, 1 ngày" required maxLength={40} defaultValue={rate?.label} />
        <TextField
          name="duration_minutes"
          label="Thời lượng (phút)"
          hint="Hết trận: thời lượng dự kiến khi không gắn sân."
          type="number"
          min={15}
          max={10080}
          step={15}
          defaultValue={rate?.duration_minutes ?? 60}
          required
        />
        <TextField name="price" label="Giá thuê / món (đ)" inputMode="numeric" required defaultValue={rate?.price} />
      </div>
      <fieldset className="flex flex-col gap-3 rounded-control border border-line p-3">
        <legend className="px-1 text-sm font-medium">Trả trễ</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <TextField
            name="grace_minutes"
            label="Ân hạn (phút)"
            type="number"
            min={0}
            max={240}
            optional
            defaultValue={rate?.grace_minutes}
          />
          <TextField
            name="overtime_block_minutes"
            label="Block (phút)"
            type="number"
            min={5}
            max={1440}
            optional
            defaultValue={rate?.overtime_block_minutes}
          />
          <TextField
            name="overtime_block_price"
            label="Giá / block (đ)"
            inputMode="numeric"
            optional
            placeholder="Tự tính"
            defaultValue={rate?.overtime_block_price ?? undefined}
          />
          <TextField
            name="overtime_cap"
            label="Trần / món (đ)"
            inputMode="numeric"
            optional
            placeholder="Không"
            defaultValue={rate?.overtime_cap ?? undefined}
          />
        </div>
        <p className="text-xs text-muted">
          Để trống: ân hạn 10 phút (hết trận 15, mang về 30–60), block 30 phút, giá block chia theo giá gói. Phụ phí đếm từ giờ hẹn trả, làm
          tròn lên theo block.
        </p>
      </fieldset>
    </>
  );
}

export function RentalRatesPanel({ productId, rates, canEdit }: { productId: string; rates: Rate[]; canEdit: boolean }) {
  return (
    <CollapsibleSection
      title="Gói giá thuê"
      description="Giá khác nhau cho dùng tại sân, hết trận và mang ra ngoài. Giá và chính sách trễ được chụp vào từng phiếu thuê."
      summary={`${rates.filter((r) => r.is_active).length} gói đang dùng`}
    >
      {rates.length === 0 ? (
        <p className="text-muted">Chưa có gói giá — sản phẩm chưa thể cho thuê.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {RENTAL_RATE_KINDS.map((k) => {
            const group = rates.filter((r) => r.usage === k.usage && r.billing === k.billing);
            if (group.length === 0) return null;
            return (
              <div key={k.value} className="flex flex-col gap-2">
                <h3 className="text-sm font-medium tracking-wide text-muted uppercase">{k.label}</h3>
                <ul className="flex flex-col divide-y divide-line rounded-control border border-line">
                  {group.map((r) => {
                    const policy = {
                      graceMinutes: r.grace_minutes,
                      blockMinutes: r.overtime_block_minutes,
                      blockPrice: r.overtime_block_price ?? autoBlockPrice(r.price, r.duration_minutes, r.overtime_block_minutes),
                      cap: r.overtime_cap,
                    };
                    return (
                      <li key={r.id} className="flex flex-col gap-2 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="flex min-w-0 flex-col">
                            <span className="font-medium">
                              {r.billing === 'session' ? r.label : formatRateLabel(r.label, r.duration_minutes)}
                            </span>
                            <span className="text-xs text-muted">Trễ: {describePolicy(policy, formatVnd)}</span>
                          </span>
                          <span className="flex items-center gap-3">
                            <span className="font-display text-lg tabular">{formatVnd(r.price)}</span>
                            {!r.is_active && <Badge>Đã tắt</Badge>}
                            {canEdit && (
                              <ActionButton
                                action={toggleRentalRateAction.bind(null, r.id, productId, !r.is_active)}
                                label={r.is_active ? 'Tắt' : 'Bật'}
                                variant="ghost"
                              />
                            )}
                          </span>
                        </div>
                        {canEdit && (
                          <Disclosure summary="Sửa gói">
                            <ActionForm action={updateRentalRateAction.bind(null, r.id, productId)}>
                              <RateFields rate={r} />
                              <SubmitButton size="sm">Lưu gói</SubmitButton>
                            </ActionForm>
                          </Disclosure>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
      {canEdit && (
        <div className="mt-4">
          <Disclosure summary="Thêm gói giá thuê">
            <ActionForm action={addRentalRateAction.bind(null, productId)} resetOnSuccess>
              <RateFields />
              <SubmitButton size="sm">Thêm gói</SubmitButton>
            </ActionForm>
          </Disclosure>
        </div>
      )}
    </CollapsibleSection>
  );
}
