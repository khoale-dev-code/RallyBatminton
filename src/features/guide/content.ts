import {
  Activity,
  Backpack,
  Feather,
  Footprints,
  Gavel,
  HeartPulse,
  LandPlot,
  MapPin,
  Ruler,
  ShieldAlert,
  Shirt,
  Swords,
  Weight,
  Wind,
  type LucideIcon,
} from 'lucide-react';

import { type CourtMode } from './lib/court';

/** Chủ đề — hiện trên thẻ và đầu bài. */
export type GuideTopic = 'luat' | 'san' | 'dung-cu' | 'ky-thuat' | 'suc-khoe' | 'rally';

export const TOPIC_LABEL: Record<GuideTopic, string> = {
  luat: 'Luật chơi',
  san: 'Sân bãi',
  'dung-cu': 'Dụng cụ',
  'ky-thuat': 'Kỹ thuật',
  'suc-khoe': 'Sức khỏe',
  rally: 'Tại Rally',
};

/** Màu ô biểu tượng — chỉ dùng bảng màu thương hiệu (xanh sân, đỏ cầu, đen, trắng). */
export type GuideTone = 'court' | 'shuttle' | 'ink' | 'paper';

/**
 * Chữ trong khối nội dung hỗ trợ 2 dạng nhấn: **in đậm** và [liên kết](/duong-dan) (chỉ đường dẫn trong web).
 */
export type GuideBlock =
  | { kind: 'text'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'list'; items: Array<{ term?: string; text: string }> }
  | { kind: 'steps'; items: Array<{ title: string; text: string }> }
  | { kind: 'cards'; items: Array<{ icon: LucideIcon; title: string; text: string }> }
  | { kind: 'faults'; items: Array<{ title: string; alias: string; text: string; allowed?: string }> }
  | { kind: 'note'; tone: 'tip' | 'warn'; title: string; text: string }
  | { kind: 'scoreboard' }
  | { kind: 'court'; initial: CourtMode }
  | { kind: 'actions'; items: Array<{ href: string; label: string; primary?: boolean }> };

/** Hình minh họa nhỏ trên thẻ ở trang Cẩm nang. */
export type GuidePreview =
  | { kind: 'score' }
  | { kind: 'court' }
  | { kind: 'big'; value: string; caption: string }
  | { kind: 'chips'; items: string[] }
  | { kind: 'dots'; count: number; caption: string }
  | { kind: 'cta' };

export interface Guide {
  slug: string;
  title: string;
  topic: GuideTopic;
  tone: GuideTone;
  icon: LucideIcon;
  /** Một câu trên thẻ. */
  summary: string;
  /** Đoạn mở đầu bài (cũng dùng làm mô tả SEO). */
  lead: string;
  preview: GuidePreview;
  /** Ý chính hiện trên thẻ lớn (bài nổi bật). */
  highlights?: string[];
  blocks: GuideBlock[];
}

/** Thứ tự = lộ trình đọc gợi ý cho người mới. */
export const GUIDES: Guide[] = [
  {
    slug: 'luat-choi',
    title: 'Luật chơi cơ bản',
    topic: 'luat',
    tone: 'court',
    icon: Gavel,
    summary: 'Tính điểm tới 21, hòa 20–20 thì sao, giao cầu đứng ô nào, khi nào được nghỉ và đổi sân.',
    lead: 'Luật thi đấu cầu lông theo Liên đoàn Cầu lông Thế giới (BWF) — nắm phần này là đủ để ra sân đánh đúng luật và tự tính điểm.',
    preview: { kind: 'score' },
    highlights: [
      'Điểm chẵn giao từ ô phải, điểm lẻ từ ô trái',
      'Lúc giao, cả quả cầu thấp hơn 1,15 m',
      'Nghỉ 60 giây khi một bên chạm 11 điểm',
    ],
    blocks: [
      { kind: 'heading', text: 'Tính điểm' },
      { kind: 'scoreboard' },
      {
        kind: 'list',
        items: [
          { term: 'Ba ván thắng hai', text: 'Mỗi ván đánh tới **21 điểm**. Thắng 2 ván là thắng trận.' },
          {
            term: 'Pha nào cũng có điểm',
            text: 'Bên thắng pha cầu được 1 điểm, **bất kể ai đang giao**. Bên thắng pha cũng được giao quả tiếp theo.',
          },
          { term: 'Hòa 20–20', text: 'Phải hơn đối phương **2 điểm** mới thắng ván: 22–20, 25–23…' },
          { term: 'Hòa 29–29', text: 'Không cần cách 2 điểm nữa — ai chạm **30** trước thắng ván.' },
        ],
      },
      { kind: 'heading', text: 'Giao cầu' },
      { kind: 'court', initial: 'serve-singles' },
      {
        kind: 'list',
        items: [
          {
            term: 'Đứng ô nào',
            text: 'Theo điểm của bên giao: **chẵn** (0, 2, 4…) giao từ ô **bên phải**, **lẻ** (1, 3, 5…) từ ô **bên trái**. Luôn giao chéo sang ô đối diện.',
          },
          { term: 'Độ cao', text: 'Lúc vợt chạm cầu, **toàn bộ quả cầu phải thấp hơn 1,15 m** tính từ mặt sân.' },
          {
            term: 'Chân',
            text: 'Người giao và người nhận đứng trong ô, **không giẫm vạch**. Một phần của cả hai bàn chân phải chạm sàn và đứng yên tới khi cầu được đánh đi.',
          },
          {
            term: 'Một động tác liên tục',
            text: 'Đã bắt đầu đưa vợt về phía trước thì không được dừng lại hay làm động tác giả.',
          },
          {
            term: 'Đánh đôi',
            text: 'Chỉ người đứng ở ô được giao tới mới được đỡ quả giao. Bên giao thắng pha: người giao **đổi sang ô kia** và giao tiếp. Bên nhận thắng pha: giành quyền giao, người đứng ở ô ứng với điểm số (chẵn phải, lẻ trái) sẽ giao — không ai đổi ô.',
          },
        ],
      },
      { kind: 'heading', text: 'Nghỉ giữa ván & đổi sân' },
      {
        kind: 'list',
        items: [
          { text: 'Khi một bên chạm **11 điểm**: được nghỉ tối đa **60 giây**.' },
          { text: 'Giữa hai ván: nghỉ tối đa **2 phút**.' },
          { text: 'Đổi sân sau mỗi ván. Nếu đánh ván 3, đổi sân thêm một lần khi một bên chạm 11 điểm.' },
        ],
      },
      {
        kind: 'note',
        tone: 'tip',
        title: 'Đánh giao lưu cho nhanh',
        text: 'Nhóm bạn thường chỉ đánh 1 ván 21 điểm, hoặc ván 15 điểm khi đông người chờ sân. Thống nhất trước khi đánh để khỏi tranh cãi.',
      },
    ],
  },
  {
    slug: 'san-don-san-doi',
    title: 'Sân đơn & sân đôi',
    topic: 'san',
    tone: 'ink',
    icon: LandPlot,
    summary: 'Vạch nào dùng cho đánh đơn, vạch nào cho đánh đôi, ô giao cầu dài – ngắn khác nhau ra sao.',
    lead: 'Một sân cầu lông có hai bộ vạch chồng lên nhau. Mẹo nhớ: **đơn hẹp mà dài, đôi giao rộng mà ngắn**.',
    preview: { kind: 'court' },
    blocks: [
      {
        kind: 'text',
        text: 'Bấm từng chế độ bên dưới để xem phần sân được dùng. Ở chế độ giao cầu, đổi điểm số để thấy người giao phải đứng ô nào.',
      },
      { kind: 'court', initial: 'singles' },
      {
        kind: 'list',
        items: [
          {
            term: 'Kích thước',
            text: 'Toàn sân **13,40 × 6,10 m**; sân đơn hẹp hơn, rộng **5,18 m**. Lưới cao **1,524 m** ở giữa sân và 1,55 m ở hai cột.',
          },
          { term: 'Đánh đơn', text: 'Dùng vạch biên dọc **phía trong** (bỏ hai hành lang bên) và kéo dài tới **vạch cuối sân**.' },
          { term: 'Đánh đôi', text: 'Khi đang đánh, dùng **toàn bộ** sân — cả hai hành lang bên.' },
          {
            term: 'Giao cầu đơn',
            text: 'Ô **hẹp và dài**: từ vạch giao cầu ngắn (cách lưới 1,98 m) tới tận vạch cuối sân.',
          },
          {
            term: 'Giao cầu đôi',
            text: 'Ô **rộng và ngắn**: chỉ tới vạch giao cầu dài dành cho đôi, cách vạch cuối sân **0,76 m**. Cầu rơi vào dải cuối cùng là giao hỏng.',
          },
          { term: 'Cầu rơi trúng vạch', text: 'Tính là **trong sân** — vạch thuộc về phần sân mà nó bao quanh.' },
        ],
      },
      {
        kind: 'note',
        tone: 'tip',
        title: 'Mẹo nhớ nhanh',
        text: 'Đánh đơn: “cắt hai bên”. Giao cầu đôi: “cắt phía sau”. Mọi trường hợp khác dùng đường ngoài cùng.',
      },
    ],
  },
  {
    slug: 'loi-thuong-gap',
    title: 'Các lỗi hay mắc',
    topic: 'luat',
    tone: 'shuttle',
    icon: ShieldAlert,
    summary: 'Chạm lưới, đánh qua lưới, giẫm vạch khi giao, chạm cầu hai lần — mất điểm oan vì đâu.',
    lead: 'Người mới mất điểm nhiều nhất vì những lỗi rất cơ bản. Đây là danh sách cần nhớ — và vài điều tưởng là lỗi nhưng không phải.',
    preview: { kind: 'big', value: '7', caption: 'lỗi hay gặp' },
    blocks: [
      {
        kind: 'faults',
        items: [
          {
            title: 'Chạm lưới',
            alias: 'Net touch',
            text: 'Vợt, người hay quần áo chạm lưới hoặc cột lưới khi pha cầu chưa kết thúc.',
          },
          {
            title: 'Đánh cầu bên sân đối phương',
            alias: 'Over the net',
            text: 'Chỉ được chạm cầu khi cầu đã sang phần sân của mình.',
            allowed: 'Chạm cầu bên mình rồi vợt theo đà vung qua lưới.',
          },
          {
            title: 'Cản trở đối phương',
            alias: 'Obstruction',
            text: 'Thò vợt hoặc người sang dưới lưới làm đối phương bị cản, hay cố tình la hét, làm động tác gây phân tâm.',
          },
          {
            title: 'Lỗi chân khi giao / nhận',
            alias: 'Foot fault',
            text: 'Giẫm vạch, nhấc chân hoặc bước đi trước khi cầu được đánh.',
          },
          {
            title: 'Giao cầu quá cao',
            alias: 'Service fault',
            text: 'Điểm chạm cầu cao hơn 1,15 m, giao hụt cầu, hoặc dừng vợt / làm động tác giả giữa chừng.',
          },
          {
            title: 'Chạm cầu hai lần, dính cầu',
            alias: 'Double hit · Sling',
            text: 'Một người đánh cầu hai lần liên tiếp, hai người cùng đội lần lượt chạm cầu, hoặc cầu bị giữ trên vợt rồi hất đi.',
            allowed: 'Cầu chạm khung và mặt lưới vợt trong cùng một cú đánh.',
          },
          {
            title: 'Cầu chạm người, chạm trần',
            alias: 'Touch',
            text: 'Cầu chạm người hoặc quần áo của bạn là bạn mất điểm. Cầu chạm trần hay vật cản trên cao cũng tính là lỗi.',
          },
        ],
      },
      {
        kind: 'note',
        tone: 'tip',
        title: 'Không chắc là lỗi hay không?',
        text: 'Đánh giao lưu không có trọng tài: bên nào thấy mình phạm lỗi thì tự nhận, còn trường hợp không rõ thì đánh lại pha đó (“let”).',
      },
    ],
  },
  {
    slug: 'chon-vot',
    title: 'Chọn vợt cho người mới',
    topic: 'dung-cu',
    tone: 'paper',
    icon: Swords,
    summary: 'Công thức dễ nhớ: 4U – thân dẻo – căng 9 đến 10,5 kg, đủ nhẹ để không đau cổ tay.',
    lead: 'Một cây vợt sai thông số có thể làm đau cổ tay và mất hứng tập. Ba con số dưới đây là điểm khởi đầu an toàn cho hầu hết người mới.',
    preview: { kind: 'chips', items: ['4U', 'Thân dẻo', '9–10,5 kg'] },
    blocks: [
      {
        kind: 'cards',
        items: [
          {
            icon: Weight,
            title: 'Trọng lượng 4U',
            text: 'Khoảng **80–84 g**. Nhẹ tay, xoay vợt nhanh, cổ tay ít bị quá tải.',
          },
          {
            icon: Wind,
            title: 'Thân dẻo',
            text: 'Thân vợt uốn cong nhiều như một chiếc lò xo, trợ lực để đánh cầu sâu về cuối sân mà không cần nhiều sức.',
          },
          {
            icon: Activity,
            title: 'Căng 9–10,5 kg',
            text: 'Căng cước nhẹ cho **điểm ngọt rộng**, chạm cầu êm, ít dội ngược vào tay. Căng hơn chỉ khi kỹ thuật đã vững.',
          },
        ],
      },
      { kind: 'heading', text: 'Điểm cân bằng' },
      {
        kind: 'list',
        items: [
          { term: 'Nặng đầu', text: 'Đập cầu uy lực nhưng nặng tay, chậm khi phản tạt. Hợp người thích tấn công cuối sân.' },
          {
            term: 'Cân bằng',
            text: '**Lựa chọn tốt nhất cho người mới**: công thủ đều, dễ làm quen trước khi biết mình thích lối đánh nào.',
          },
          { term: 'Nhẹ đầu', text: 'Phản tạt, chặn lưới nhanh. Hợp người đánh đôi đứng trên.' },
        ],
      },
      { kind: 'heading', text: 'Cỡ cán' },
      {
        kind: 'text',
        text: 'Cán **G4** hoặc **G5** phổ biến nhất (số càng lớn cán càng nhỏ). Tay nhỏ chọn G5 — muốn cán to hơn chỉ cần quấn thêm một lớp cán.',
      },
      {
        kind: 'note',
        tone: 'tip',
        title: 'Chưa muốn mua vợt?',
        text: '[Thuê vợt ngay tại quầy](/rentals) để thử vài buổi trước, hoặc xem [vợt và phụ kiện](/products) có bán tại Rally.',
      },
    ],
  },
  {
    slug: 'ky-thuat-nen-tang',
    title: 'Kỹ thuật nền tảng',
    topic: 'ky-thuat',
    tone: 'court',
    icon: Footprints,
    summary: 'Cầm vợt đúng, tư thế chờ cầu, bước chân về giữa sân và 4 cú đánh nên tập đầu tiên.',
    lead: 'Đánh đẹp bắt đầu từ cách cầm vợt và bước chân, không phải từ sức mạnh. Tập đúng từ đầu sẽ đỡ mất thời gian sửa thói quen sau này.',
    preview: { kind: 'chips', items: ['Clear', 'Drop', 'Smash', 'Net'] },
    blocks: [
      { kind: 'heading', text: 'Cầm vợt' },
      {
        kind: 'list',
        items: [
          {
            term: 'Thuận tay',
            text: 'Cầm như **bắt tay** với cán vợt, mặt vợt vuông góc với sàn. Khe chữ V giữa ngón cái và ngón trỏ nằm trên cạnh hẹp của cán.',
          },
          {
            term: 'Trái tay',
            text: 'Xoay cán nhẹ, đặt **bụng ngón cái** lên mặt rộng phía sau cán để làm điểm đẩy.',
          },
          { term: 'Cầm lỏng', text: 'Chỉ siết chặt tay đúng lúc chạm cầu — cầm cứng suốt pha cầu làm chậm cổ tay và nhanh mỏi.' },
        ],
      },
      { kind: 'heading', text: 'Tư thế chờ & bước chân' },
      {
        kind: 'list',
        items: [
          { text: 'Hai chân rộng hơn vai, gối hơi chùng, trọng tâm dồn lên **mũi chân**, vợt giơ trước ngực.' },
          { text: 'Nhún nhẹ (**bước đệm**) đúng lúc đối phương chạm cầu để bật đi nhanh hơn.' },
          { text: 'Đánh xong luôn **trở về giữa sân** rồi mới chờ cú tiếp theo.' },
          { text: 'Lên lưới: chân thuận tay bước sau cùng (người thuận tay phải dùng chân phải).' },
        ],
      },
      { kind: 'heading', text: '4 cú đánh nên tập trước' },
      {
        kind: 'steps',
        items: [
          { title: 'Phông cầu cao sâu (Clear)', text: 'Đánh cầu bay cao về cuối sân đối phương để có thời gian về vị trí.' },
          {
            title: 'Bỏ nhỏ (Drop)',
            text: 'Từ cuối sân, đưa cầu rơi nhẹ sát lưới bên kia — cùng động tác như phông cầu để đối phương khó đoán.',
          },
          {
            title: 'Đập cầu (Smash)',
            text: 'Đánh mạnh, cắm xuống khi cầu cao và ở phía trước người. Sức đến từ xoay thân và cổ tay, không chỉ từ cánh tay.',
          },
          { title: 'Đánh sát lưới (Net shot)', text: 'Chạm cầu nhẹ ở điểm cao nhất gần lưới để cầu lật qua lưới rồi rơi ngay.' },
        ],
      },
      {
        kind: 'note',
        tone: 'tip',
        title: 'Buổi tập 15 phút',
        text: 'Đánh qua lại chậm với bạn: 5 phút phông cầu, 5 phút bỏ nhỏ – đánh sát lưới, 5 phút đập cầu nhẹ. Đúng động tác quan trọng hơn đánh mạnh.',
      },
    ],
  },
  {
    slug: 'khoi-dong',
    title: 'Khởi động & tránh chấn thương',
    topic: 'suc-khoe',
    tone: 'shuttle',
    icon: HeartPulse,
    summary: '10 phút khởi động đúng cách và những chấn thương người chơi cầu lông hay gặp.',
    lead: 'Cầu lông có nhiều cú bật, đổi hướng đột ngột và vung tay nhanh. Mười phút khởi động trước khi đánh giúp giảm đáng kể nguy cơ lật cổ chân hay căng cơ.',
    preview: { kind: 'big', value: '10′', caption: 'khởi động trước khi đánh' },
    blocks: [
      {
        kind: 'steps',
        items: [
          {
            title: 'Làm nóng người (3 phút)',
            text: 'Chạy nhẹ tại chỗ, nhảy dây hoặc bước ngang qua lại trên sân tới khi người ấm và hơi ra mồ hôi.',
          },
          { title: 'Xoay khớp (2 phút)', text: 'Cổ chân, gối, hông, vai, cổ tay — xoay mỗi khớp vài vòng theo cả hai chiều.' },
          { title: 'Động tác động (2 phút)', text: 'Bước chùng chân về trước, xoay thân, vung tay không cầm vợt như đang đập cầu.' },
          { title: 'Đánh nhẹ (3 phút)', text: 'Đánh qua lại chậm, sau đó mới tăng tốc và đập cầu mạnh.' },
        ],
      },
      { kind: 'heading', text: 'Chấn thương hay gặp' },
      {
        kind: 'list',
        items: [
          {
            term: 'Lật cổ chân',
            text: 'Do giày không phù hợp hoặc lùi về cuối sân bằng gót chân. Đi giày cầu lông và lùi bằng bước xoay người.',
          },
          { term: 'Đau cổ tay, khuỷu tay', text: 'Thường do vợt quá nặng, căng cước quá cao hoặc cầm vợt quá chặt.' },
          { term: 'Căng bắp chân, gân gót', text: 'Hay gặp khi bỏ qua khởi động hoặc đánh lâu mà không nghỉ.' },
        ],
      },
      {
        kind: 'note',
        tone: 'warn',
        title: 'Khi bị đau',
        text: 'Đau nhói hoặc sưng thì dừng chơi ngay, nghỉ và chườm lạnh. Đau kéo dài vài ngày nên đi khám. Uống nước giữa các ván, và giãn cơ nhẹ 5 phút sau buổi chơi.',
      },
    ],
  },
  {
    slug: 'giay-cau-do-dung',
    title: 'Giày, quả cầu & đồ mang theo',
    topic: 'dung-cu',
    tone: 'ink',
    icon: Backpack,
    summary: 'Vì sao nên đi giày cầu lông, cầu lông vũ khác cầu nhựa thế nào, và túi đồ gọn cho một buổi chơi.',
    lead: 'Ngoài cây vợt, đôi giày là món quan trọng nhất — nó giữ cổ chân an toàn và giữ cho mặt sân không bị trầy.',
    preview: { kind: 'chips', items: ['Giày', 'Cầu', 'Khăn', 'Nước'] },
    blocks: [
      {
        kind: 'cards',
        items: [
          {
            icon: Footprints,
            title: 'Giày cầu lông',
            text: 'Đế cao su mỏng, bám sàn và **không để lại vết**. Giày chạy bộ đế dày, mềm, dễ lật cổ chân khi đổi hướng.',
          },
          {
            icon: Feather,
            title: 'Quả cầu',
            text: '**Cầu lông vũ** bay chuẩn, dùng khi đánh nghiêm túc. **Cầu nhựa** bền hơn, rẻ hơn, hợp tập luyện.',
          },
          {
            icon: Shirt,
            title: 'Trang phục',
            text: 'Áo quần thể thao thấm mồ hôi, tất dày vừa chân. Mang thêm một áo để thay sau buổi chơi.',
          },
        ],
      },
      { kind: 'heading', text: 'Túi đồ một buổi chơi' },
      {
        kind: 'list',
        items: [
          { text: 'Vợt (hoặc thuê tại quầy), quả cầu.' },
          { text: 'Giày cầu lông — thay ở sân, không đi từ ngoài đường vào.' },
          { text: 'Khăn, nước uống, áo thay.' },
          { text: 'Băng cổ chân, cổ tay nếu từng bị đau.' },
        ],
      },
      {
        kind: 'note',
        tone: 'tip',
        title: 'Quên đồ?',
        text: 'Rally có [cho thuê vợt, giày](/rentals) và bán [cầu, nước uống, phụ kiện](/products) ngay tại quầy.',
      },
    ],
  },
  {
    slug: 'quan-can-vot',
    title: 'Quấn cán vợt',
    topic: 'dung-cu',
    tone: 'paper',
    icon: Ruler,
    summary: '5 bước quấn cán êm, bám tay, không bong — làm một lần là nhớ.',
    lead: 'Quấn cán giúp tay không trơn khi ra mồ hôi và cầm êm hơn. Thay cán mới khi thấy trơn, mòn hoặc bong mép.',
    preview: { kind: 'dots', count: 5, caption: 'bước' },
    blocks: [
      {
        kind: 'steps',
        items: [
          {
            title: 'Chuẩn bị',
            text: 'Mở cuộn quấn cán, để riêng dải băng keo chốt đi kèm, bóc lớp màng nilon. Có thể giữ lớp cán gốc bên dưới cho êm hơn.',
          },
          {
            title: 'Bắt đầu từ đuôi cán',
            text: 'Bóc giấy che keo ở đầu vát, dán mép vát sát viền đáy cán. Quấn chặt vòng đầu tiên để khóa góc.',
          },
          {
            title: 'Quấn xoắn lên',
            text: 'Vừa quấn vừa kéo căng đều tay. Mỗi vòng chồng lên khoảng **1/3 bản** của vòng trước để mặt cán phẳng, không hở.',
          },
          {
            title: 'Cắt vát phần cuối',
            text: 'Quấn tới chỗ cán nối thân vợt thì dừng. Cắt chéo phần thừa để mép cuối thành một đường vòng gọn quanh cán.',
          },
          {
            title: 'Dán băng chốt',
            text: 'Quấn dải băng keo 1–2 vòng đè lên mép vừa cắt, miết chặt để không bị bong khi đánh.',
          },
        ],
      },
      {
        kind: 'note',
        tone: 'tip',
        title: 'Hết quấn cán?',
        text: 'Mua [quấn cán tại quầy](/products) — nhân viên quấn giúp nếu bạn cần.',
      },
    ],
  },
  {
    slug: 'lan-dau-den-rally',
    title: 'Lần đầu đến Rally',
    topic: 'rally',
    tone: 'ink',
    icon: MapPin,
    summary: 'Đặt sân trong một phút, đến nơi đọc số điện thoại là vào sân. Muốn chơi thêm giờ cũng dễ.',
    lead: 'Mọi thứ bạn cần biết cho buổi chơi đầu tiên ở Rally — từ lúc đặt sân tới khi ra về.',
    preview: { kind: 'cta' },
    blocks: [
      {
        kind: 'steps',
        items: [
          {
            title: 'Đặt sân trực tuyến',
            text: 'Chọn chi nhánh, sân và giờ trống ở [Đặt sân](/booking). Chỉ cần tên và số điện thoại — không cần tài khoản.',
          },
          {
            title: 'Xem lại đơn bất cứ lúc nào',
            text: 'Dùng [Tra cứu đơn](/booking/lookup) bằng số điện thoại để xem giờ, sân và số tiền.',
          },
          {
            title: 'Đến sớm vài phút',
            text: 'Đủ thời gian thay giày và khởi động. Báo tên hoặc số điện thoại ở quầy, nhân viên mở sân cho bạn.',
          },
          {
            title: 'Muốn chơi thêm?',
            text: 'Báo nhân viên quầy. Nếu sân còn trống, đơn được gia hạn ngay và bạn trả một lần khi ra về.',
          },
          {
            title: 'Chơi nhiều, nhận nhiều',
            text: '[Đăng ký thành viên](/register) để xem lại mọi lần đặt sân và tích điểm.',
          },
        ],
      },
      {
        kind: 'actions',
        items: [
          { href: '/booking', label: 'Đặt sân ngay', primary: true },
          { href: '/branches', label: 'Xem chi nhánh' },
        ],
      },
    ],
  },
];

export function findGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

/** Bài kế tiếp theo lộ trình đọc (bài cuối quay về bài đầu). */
export function nextGuide(slug: string): Guide {
  const i = GUIDES.findIndex((g) => g.slug === slug);
  return GUIDES[(i + 1) % GUIDES.length];
}
