/** Bố cục lịch kiểu Google Calendar: vị trí theo giờ, ca trùng giờ chia cột cạnh nhau. Không phụ thuộc React. */

export interface TimedItem {
  id: string;
  /** Phút tính từ 00:00 của ngày làm (có thể > 1440 với ca qua nửa đêm). */
  startMin: number;
  endMin: number;
}

export interface PlacedItem {
  id: string;
  lane: number;
  lanes: number;
}

/**
 * Xếp làn: các ca chồng giờ nhau nằm cạnh nhau, chia đều bề ngang của cả cụm.
 * Thuật toán tham lam theo giờ bắt đầu (giống lịch Google / Outlook).
 */
export function layoutDay(items: TimedItem[]): Map<string, PlacedItem> {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out = new Map<string, PlacedItem>();
  let cluster: Array<{ id: string; lane: number }> = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const lanes = Math.max(1, laneEnds.length);
    for (const c of cluster) out.set(c.id, { id: c.id, lane: c.lane, lanes });
    cluster = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    if (item.startMin >= clusterEnd && cluster.length > 0) flush();
    let lane = laneEnds.findIndex((end) => end <= item.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.endMin);
    } else {
      laneEnds[lane] = item.endMin;
    }
    cluster.push({ id: item.id, lane });
    clusterEnd = Math.max(clusterEnd === -Infinity ? item.endMin : clusterEnd, item.endMin);
  }
  if (cluster.length > 0) flush();
  return out;
}

/** Khung giờ hiển thị: từ giờ sớm nhất tới giờ muộn nhất có ca (tối thiểu 8 giờ, trong 0–24). */
export function hourRange(items: TimedItem[], fallback: [number, number] = [6, 22]): [number, number] {
  if (items.length === 0) return fallback;
  let start = Math.floor(Math.min(...items.map((i) => i.startMin)) / 60);
  let end = Math.ceil(Math.max(...items.map((i) => Math.min(i.endMin, 1440))) / 60);
  start = Math.max(0, Math.min(start, 23));
  end = Math.min(24, Math.max(end, start + 1));
  if (end - start < 8) {
    end = Math.min(24, start + 8);
    start = Math.max(0, end - 8);
  }
  return [start, end];
}

/** Màu nhận diện theo nhân viên (ổn định theo mã), dùng cho vạch trái & nền nhạt của ô ca. */
export const EMPLOYEE_COLORS = ['#2e6b1f', '#0f766e', '#1d4ed8', '#7c3aed', '#b45309', '#be185d', '#475569', '#4d7c0f'] as const;

export function employeeColor(key: string | null | undefined): string {
  const text = key ?? '';
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return EMPLOYEE_COLORS[hash % EMPLOYEE_COLORS.length] ?? EMPLOYEE_COLORS[0];
}
