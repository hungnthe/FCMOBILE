/**
 * Phân loại kỷ lục CLB Ajax:
 * 
 * 1. Kỷ lục có thể bị xô đổ (Breakable Records) - Gồm 13 kỷ lục:
 *    - Cầu thủ nhiều danh hiệu nhất mọi thời đại
 *    - Cầu thủ ra sân nhiều nhất mọi thời đại
 *    - Cầu thủ dành nhiều quả bóng vàng nhất mọi thời đại
 *    - Bàn thắng nhiều trong một mùa
 *    - Kiến tạo nhiều trong một mùa
 *    - Chân sút vĩ đại nhất mọi thời đại
 *    - Cầu thủ kiến tạo nhất mọi thời đại
 *    - Ông vua của các khoảng khắc bùng nổ
 *    - Cầu thủ đá phạt thành bàn nhiều nhất mọi thời đại
 *    - Ông vua của các trận cầu lớn
 *    - Cầu thủ có nhiều bàn thắng đẹp nhất mùa nhất
 *    - Cầu thủ phòng thủ tốt nhất mọi thời đại
 *    - Tiền vệ xuất sắc nhất mọi thời đại
 *    => Trạng thái: "Đang nắm giữ" (hoặc "Đồng nắm giữ") hoặc "Đã từng nắm giữ" (khi đã bị vượt qua).
 * 
 * 2. Kỷ lục thành tích / mốc danh hiệu (Milestone / Permanent Records) - Các kỷ lục còn lại:
 *    - Hai mùa giải liên tiếp dành vua phá lưới
 *    - Hai mùa giải liên tiếp dành vua kiến tạo
 *    - Hai lần đạt danh hiệu quả bóng vàng liên tiếp
 *    - Hai lần đạt danh hiệu quả bóng bạc liên tiếp
 *    - Hai lần đạt danh hiệu quả bóng đồng liên tiếp
 *    - Cầu thủ dành 2 lần bàn thắng đẹp nhất mùa
 *    => Trạng thái: "Đã giành được" (sở hữu vĩnh viễn một khi đã đạt, có thể thuộc về nhiều cầu thủ).
 */

export const BREAKABLE_RECORD_NAMES = [
  'Cầu thủ nhiều danh hiệu nhất mọi thời đại',
  'Cầu thủ ra sân nhiều nhất mọi thời đại',
  'Cầu thủ dành nhiều quả bóng vàng nhất mọi thời đại',
  'Bàn thắng nhiều trong một mùa',
  'Kiến tạo nhiều trong một mùa',
  'Chân sút vĩ đại nhất mọi thời đại',
  'Cầu thủ kiến tạo nhất mọi thời đại',
  'Ông vua của các khoảng khắc bùng nổ',
  'Cầu thủ đá phạt thành bàn nhiều nhất mọi thời đại',
  'Ông vua của các trận cầu lớn',
  'Cầu thủ có nhiều bàn thắng đẹp nhất mùa nhất',
  'Cầu thủ phòng thủ tốt nhất mọi thời đại',
  'Tiền vệ xuất sắc nhất mọi thời đại'
];

export const BREAKABLE_RECORD_IDS = new Set([
  1,  // Cầu thủ nhiều danh hiệu nhất mọi thời đại
  7,  // Bàn thắng nhiều trong một mùa
  8,  // Kiến tạo nhiều trong một mùa
  9,  // Cầu thủ ra sân nhiều nhất mọi thời đại
  10, // Cầu thủ dành nhiều quả bóng vàng nhất mọi thời đại
  11, // Ông vua của các khoảng khắc bùng nổ
  12, // Cầu thủ đá phạt thành bàn nhiều nhất mọi thời đại
  13, // Ông vua của các trận cầu lớn
  15, // Cầu thủ có nhiều bàn thắng đẹp nhất mùa nhất
  16, // Cầu thủ phòng thủ tốt nhất mọi thời đại
  17, // Tiền vệ xuất sắc nhất mọi thời đại
  18, // Chân sút vĩ đại nhất mọi thời đại
  19  // Cầu thủ kiến tạo nhất mọi thời đại
]);

export const normalizeRecordText = (value) =>
  String(value || '')
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();

const BREAKABLE_NAMES_NORM = new Set(BREAKABLE_RECORD_NAMES.map(normalizeRecordText));

export function isBreakableRecord(record) {
  if (!record) return false;
  const id = Number(record.record_id);
  if (id && BREAKABLE_RECORD_IDS.has(id)) return true;
  const norm = normalizeRecordText(record.name);
  return BREAKABLE_NAMES_NORM.has(norm);
}

/**
 * Xác định trạng thái của cầu thủ đối với một kỷ lục:
 * - 'current': Đang nắm giữ kỷ lục (kỷ lục có thể bị xô đổ)
 * - 'past': Đã từng nắm giữ (kỷ lục có thể bị xô đổ, từng giữ nhưng đã bị xô đổ)
 * - 'achieved': Đã giành được (kỷ lục mốc thành tích, sở hữu vĩnh viễn, nhiều người có thể cùng đạt)
 * - null: Cầu thủ không sở hữu / chưa đạt
 */
export function getPlayerRecordStatus(record, player) {
  if (!record || !player) return null;

  const targetId = Number(player.player_id);
  const targetNameNorm = normalizeRecordText(player.name);

  const match = (pid, pname) => {
    if (pid && targetId && Number(pid) === targetId) return true;
    if (pname && targetNameNorm && normalizeRecordText(pname) === targetNameNorm) return true;
    return false;
  };

  const isPrimary = match(record.player_id, record.player);
  const isCo = Array.isArray(record.co_players) && record.co_players.some((co) => match(co.player_id, co.player));
  const isHolder = isPrimary || isCo;
  const breakable = isBreakableRecord(record);

  if (breakable) {
    if (isHolder) {
      return {
        type: 'current',
        isBreakable: true,
        isCoHolder: isCo && !isPrimary,
        hasCoHolders: (record.co_players?.length || 0) > 0,
        label: isCo && !isPrimary ? 'Đồng nắm giữ' : 'Đang nắm giữ'
      };
    }
    const history = Array.isArray(record.player_history) ? record.player_history : [];
    const wasPast = history.some((h) => match(h.player_id, h.player));
    if (wasPast) {
      return {
        type: 'past',
        isBreakable: true,
        isCoHolder: false,
        hasCoHolders: false,
        label: 'Đã từng nắm giữ'
      };
    }
    return null;
  }

  // Kỷ lục thành tích / mốc danh hiệu: Một khi đã đạt được thì vĩnh viễn giữ danh hiệu
  const history = Array.isArray(record.player_history) ? record.player_history : [];
  const inHistory = history.some((h) => match(h.player_id, h.player));
  if (isHolder || inHistory) {
    return {
      type: 'achieved',
      isBreakable: false,
      isCoHolder: false,
      hasCoHolders: (record.co_players?.length || 0) > 0,
      label: 'Đã giành được'
    };
  }

  return null;
}
