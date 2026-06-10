import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';

export enum ShiftCode {
  MORNING = 'MORNING',
  AFTERNOON = 'AFTERNOON',
  FULL_DAY = 'FULL_DAY',
}

@Entity({ name: 'shifts', schema: 'HRM' })
export class Shift {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ unique: true, length: 30 })
  code: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime: string;

  @Column({ name: 'break_minutes', type: 'smallint', default: 0 })
  breakMinutes: number;

  @Column({ name: 'grace_minutes', type: 'smallint', default: 5 })
  graceMinutes: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
