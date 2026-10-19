import { describe, expect, it } from 'vitest';

import { autoBlockPrice, computeOvertime, defaultPolicy, describePolicy, effectiveDue, formatSpan, rentalProgress } from './rental-fee';

const due = new Date('2026-10-18T13:00:00Z');
const after = (min: number) => new Date(due.getTime() + min * 60000);
const policy = { graceMinutes: 10, blockMinutes: 30, blockPrice: 15000, cap: null };

describe('computeOvertime', () => {
  it('không tính phí khi trả đúng hạn hoặc sớm', () => {
    expect(computeOvertime(due, after(-20), 1, policy)).toMatchObject({ lateMinutes: 0, fee: 0, inGrace: false });
  });

  it('trong ân hạn thì 0đ nhưng đánh dấu đang ân hạn', () => {
    expect(computeOvertime(due, after(10), 1, policy)).toMatchObject({ lateMinutes: 10, fee: 0, inGrace: true });
  });

  it('quá ân hạn: block đếm từ hạn trả, làm tròn lên', () => {
    expect(computeOvertime(due, after(11), 1, policy)).toMatchObject({ blocks: 1, fee: 15000 });
    expect(computeOvertime(due, after(30), 1, policy)).toMatchObject({ blocks: 1, fee: 15000 });
    expect(computeOvertime(due, after(31), 1, policy)).toMatchObject({ blocks: 2, fee: 30000 });
  });

  it('thuê 1 giờ nhưng 2 giờ sau mới trả → trễ 60 phút = 2 block', () => {
    const start = new Date(due.getTime() - 60 * 60000);
    const returned = new Date(start.getTime() + 120 * 60000);
    expect(computeOvertime(due, returned, 1, policy)).toMatchObject({ lateMinutes: 60, blocks: 2, fee: 30000 });
  });

  it('nhân theo số món và giới hạn bởi trần', () => {
    expect(computeOvertime(due, after(95), 2, policy).fee).toBe(4 * 15000 * 2);
    const capped = computeOvertime(due, after(600), 2, { ...policy, cap: 50000 });
    expect(capped).toMatchObject({ fee: 100000, capped: true });
  });

  it('bỏ qua giây lẻ', () => {
    expect(computeOvertime(due, new Date(due.getTime() + 10 * 60000 + 59000), 1, policy).fee).toBe(0);
  });
});

describe('giá và chính sách mặc định', () => {
  it('giá block theo tỉ lệ, làm tròn lên 1.000đ', () => {
    expect(autoBlockPrice(30000, 60, 30)).toBe(15000);
    expect(autoBlockPrice(50000, 120, 30)).toBe(13000);
    expect(autoBlockPrice(120000, 1440, 720)).toBe(60000);
    expect(autoBlockPrice(0, 60, 30)).toBe(0);
  });

  it('mặc định theo hình thức', () => {
    expect(defaultPolicy('on_site', 'duration', 60)).toEqual({ graceMinutes: 10, blockMinutes: 30 });
    expect(defaultPolicy('on_site', 'session', 120)).toEqual({ graceMinutes: 15, blockMinutes: 30 });
    expect(defaultPolicy('take_out', 'duration', 1440)).toEqual({ graceMinutes: 60, blockMinutes: 720 });
    expect(defaultPolicy('take_out', 'duration', 480)).toEqual({ graceMinutes: 30, blockMinutes: 60 });
  });

  it('mô tả chính sách', () => {
    const money = (n: number) => `${n / 1000}k`;
    expect(describePolicy(policy, money)).toBe('Ân hạn 10 phút · 15k / 30 phút / món');
    expect(describePolicy({ graceMinutes: 0, blockMinutes: 60, blockPrice: 20000, cap: 80000 }, money)).toBe(
      'Không ân hạn · 20k / giờ / món · tối đa 80k/món',
    );
  });
});

describe('hạn trả & hiển thị', () => {
  it('thuê theo trận lùi hạn theo giờ kết thúc sân khi khách gia hạn', () => {
    const later = after(30);
    expect(effectiveDue(due.toISOString(), 'session', later).getTime()).toBe(later.getTime());
    expect(effectiveDue(due.toISOString(), 'duration', later).getTime()).toBe(due.getTime());
    expect(effectiveDue(due.toISOString(), 'session', after(-30)).getTime()).toBe(due.getTime());
  });

  it('định dạng khoảng thời gian', () => {
    expect(formatSpan(45)).toBe('45 phút');
    expect(formatSpan(65)).toBe('1 giờ 5 phút');
    expect(formatSpan(1440 + 180)).toBe('1 ngày 3 giờ');
  });

  it('tiến độ thuê', () => {
    const start = new Date(due.getTime() - 60 * 60000).toISOString();
    expect(rentalProgress(start, due, after(-30).getTime())).toBeCloseTo(0.5);
    expect(rentalProgress(start, due, after(10).getTime())).toBe(1);
  });
});
