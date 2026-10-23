/**
 * Kích thước sân cầu lông theo BWF (mét). Sân vẽ nằm ngang: trục x theo chiều dài (lưới ở giữa),
 * trục y theo chiều rộng. Người giao cầu luôn ở nửa trái, nhìn về phía lưới (sang phải).
 */
export const COURT = {
  length: 13.4,
  width: 6.1,
  /** Hành lang bên dành cho đánh đôi. */
  sideAlley: 0.46,
  /** Vạch giao cầu ngắn cách lưới. */
  shortService: 1.98,
  /** Vạch giao cầu dài (đôi) cách vạch cuối sân. */
  doublesLong: 0.76,
} as const;

export const NET_X = COURT.length / 2;

export type CourtMode = 'singles' | 'doubles' | 'serve-singles' | 'serve-doubles';

export const COURT_MODES: Array<{ mode: CourtMode; label: string }> = [
  { mode: 'singles', label: 'Đánh đơn' },
  { mode: 'doubles', label: 'Đánh đôi' },
  { mode: 'serve-singles', label: 'Giao cầu đơn' },
  { mode: 'serve-doubles', label: 'Giao cầu đôi' },
];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const isServeMode = (mode: CourtMode): boolean => mode === 'serve-singles' || mode === 'serve-doubles';

/** Phần sân được dùng khi đang đánh (đơn bỏ hai hành lang bên). */
export function playArea(mode: CourtMode): Rect {
  const { length, width, sideAlley } = COURT;
  if (mode === 'singles' || mode === 'serve-singles') return { x: 0, y: sideAlley, w: length, h: width - 2 * sideAlley };
  return { x: 0, y: 0, w: length, h: width };
}

/** Điểm chẵn → ô bên phải của người giao. Người giao nhìn sang phải nên "bên phải" là nửa dưới hình. */
export const serveSide = (score: number): 'right' | 'left' => (score % 2 === 0 ? 'right' : 'left');

/** Ô đứng giao cầu (nửa trái) và ô phải rơi vào (nửa phải, chéo đối diện). */
export function serviceBoxes(mode: 'serve-singles' | 'serve-doubles', score: number): { server: Rect; target: Rect } {
  const { width, sideAlley, shortService, doublesLong } = COURT;
  const half = width / 2;
  const singles = mode === 'serve-singles';
  const back = singles ? 0 : doublesLong;
  const edge = singles ? sideAlley : 0;
  const depth = NET_X - shortService - back;
  // Ô bên phải người giao (nửa dưới) và ô đối diện chéo (nửa trên bên kia lưới).
  const server: Rect = { x: back, y: half, w: depth, h: half - edge };
  const target: Rect = { x: NET_X + shortService, y: edge, w: depth, h: half - edge };
  if (serveSide(score) === 'right') return { server, target };
  return {
    server: { ...server, y: width - server.y - server.h },
    target: { ...target, y: width - target.y - target.h },
  };
}

/** Câu giải thích dưới sơ đồ. */
export function courtCaption(mode: CourtMode, score: number): string {
  switch (mode) {
    case 'singles':
      return 'Đánh đơn: sân hẹp (bỏ hai hành lang bên) nhưng dài hết tới vạch cuối sân.';
    case 'doubles':
      return 'Đánh đôi: dùng toàn bộ sân khi đang đánh, kể cả hai hành lang bên.';
    case 'serve-singles':
    case 'serve-doubles': {
      const side = serveSide(score) === 'right' ? 'phải' : 'trái';
      const parity = score % 2 === 0 ? 'chẵn' : 'lẻ';
      const shape =
        mode === 'serve-singles' ? 'Ô giao đơn hẹp mà dài — tới vạch cuối sân.' : 'Ô giao đôi rộng mà ngắn — chỉ tới vạch giao cầu dài.';
      return `Điểm ${score} là số ${parity} → đứng ô bên ${side}, giao chéo sang ô đối diện. ${shape}`;
    }
  }
}
