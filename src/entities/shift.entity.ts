import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';

/** Một buổi làm trong ca. Giờ dạng 'HH:mm:ss', `start` < `end`. */
export interface ShiftSession {
  name: string;
  start: string;
  end: string;
}

/**
 * Một ca làm việc = giờ làm của CẢ NGÀY, gồm một hoặc nhiều buổi
 * (VD: sáng + chiều, hoặc chỉ một buổi tối 17:00-19:00 cho nhân viên bán thời gian).
 * Khoảng nghỉ chính là chỗ trống giữa các buổi, nên không cần khai báo riêng.
 */
@Entity({ name: 'shifts', schema: 'HRM' })
export class Shift {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ unique: true, length: 30 })
  code: string;

  @Column({ length: 100 })
  name: string;

  /** Các buổi làm, xếp theo giờ bắt đầu, không chồng lên nhau. */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  sessions: ShiftSession[];

  @Column({ name: 'grace_minutes', type: 'smallint', default: 5 })
  graceMinutes: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
