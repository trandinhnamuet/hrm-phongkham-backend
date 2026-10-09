import { BadRequestException } from '@nestjs/common';

/**
 * Chuẩn hoá số điện thoại để lưu và để so khi đăng nhập:
 * bỏ khoảng trắng / dấu chấm / gạch / ngoặc, đổi đầu số +84 (hoặc 84 ở số 11 chữ số) về 0.
 * "0912 345.678", "+84912345678", "84912345678" đều thành "0912345678".
 *
 * Chuỗi rỗng -> null. Không phải số điện thoại -> BadRequestException.
 */
export function normalizePhone(raw?: string | null): string | null {
  if (raw === undefined || raw === null) return null;
  let p = raw.replace(/[\s.\-()]/g, '');
  if (!p) return null;
  if (p.startsWith('+84')) p = '0' + p.slice(3);
  else if (p.startsWith('84') && p.length === 11) p = '0' + p.slice(2);
  if (!/^\+?\d{8,15}$/.test(p)) {
    throw new BadRequestException(`Số điện thoại không hợp lệ: ${raw}`);
  }
  return p;
}

/** Email lưu chữ thường, bỏ khoảng trắng hai đầu. Chuỗi rỗng -> null. */
export function normalizeEmail(raw?: string | null): string | null {
  if (raw === undefined || raw === null) return null;
  const e = raw.trim().toLowerCase();
  return e || null;
}
