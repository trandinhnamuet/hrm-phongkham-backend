import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';

/**
 * Một ca làm việc = giờ làm của CẢ NGÀY: buổi sáng + buổi chiều.
 * Nghỉ trưa chính là khoảng trống giữa `morningEnd` và `afternoonStart`,
 * nên không cần khai báo riêng số phút nghỉ.
 */
@Entity({ name: 'shifts', schema: 'HRM' })
export class Shift {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ unique: true, length: 30 })
  code: string;

  @Column({ length: 100 })
  name: string;

  /** 'HH:mm:ss'. Null nếu ca không làm buổi sáng. */
  @Column({ name: 'morning_start', type: 'time', nullable: true })
  morningStart: string | null;

  @Column({ name: 'morning_end', type: 'time', nullable: true })
  morningEnd: string | null;

  /** 'HH:mm:ss'. Null nếu ca không làm buổi chiều. */
  @Column({ name: 'afternoon_start', type: 'time', nullable: true })
  afternoonStart: string | null;

  @Column({ name: 'afternoon_end', type: 'time', nullable: true })
  afternoonEnd: string | null;

  @Column({ name: 'grace_minutes', type: 'smallint', default: 5 })
  graceMinutes: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
