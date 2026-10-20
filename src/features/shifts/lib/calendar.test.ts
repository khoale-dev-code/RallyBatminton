import { describe, expect, it } from 'vitest';

import { employeeColor, EMPLOYEE_COLORS, hourRange, layoutDay } from './calendar';

describe('lịch dạng lưới giờ', () => {
  it('ca trùng giờ chia làn cạnh nhau, ca rời nhau dùng cả bề ngang', () => {
    const placed = layoutDay([
      { id: 'a', startMin: 330, endMin: 810 }, // 05:30–13:30
      { id: 'b', startMin: 360, endMin: 840 }, // 06:00–14:00
      { id: 'c', startMin: 930, endMin: 1410 }, // 15:30–23:30
      { id: 'd', startMin: 1020, endMin: 1320 }, // 17:00–22:00
      { id: 'e', startMin: 1410, endMin: 1440 },
    ]);
    expect(placed.get('a')).toMatchObject({ lane: 0, lanes: 2 });
    expect(placed.get('b')).toMatchObject({ lane: 1, lanes: 2 });
    expect(placed.get('c')).toMatchObject({ lane: 0, lanes: 2 });
    expect(placed.get('d')).toMatchObject({ lane: 1, lanes: 2 });
    expect(placed.get('e')).toMatchObject({ lane: 0, lanes: 1 });
  });

  it('dùng lại làn đã trống trong cùng cụm', () => {
    const placed = layoutDay([
      { id: 'a', startMin: 0, endMin: 600 },
      { id: 'b', startMin: 60, endMin: 120 },
      { id: 'c', startMin: 180, endMin: 240 },
    ]);
    expect(placed.get('c')).toMatchObject({ lane: 1, lanes: 2 });
  });

  it('khung giờ hiển thị vừa đủ, tối thiểu 8 giờ', () => {
    expect(hourRange([{ id: 'a', startMin: 330, endMin: 1410 }])).toEqual([5, 24]);
    expect(hourRange([{ id: 'a', startMin: 600, endMin: 720 }])).toEqual([10, 18]);
    expect(hourRange([{ id: 'a', startMin: 1320, endMin: 1800 }])).toEqual([16, 24]);
    expect(hourRange([])).toEqual([6, 22]);
  });

  it('màu nhân viên ổn định', () => {
    expect(employeeColor('NV-01')).toBe(employeeColor('NV-01'));
    expect(EMPLOYEE_COLORS).toContain(employeeColor('x'));
  });
});
