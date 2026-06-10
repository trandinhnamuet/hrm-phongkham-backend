import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, Unique,
} from 'typeorm';
import { User } from './user.entity';
import { Shift } from './shift.entity';

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  LATE = 'LATE',
  ABSENT = 'ABSENT',
  ON_LEAVE = 'ON_LEAVE',
  HOLIDAY = 'HOLIDAY',
  SHORT_HOURS = 'SHORT_HOURS',
}

@Entity({ name: 'attendance_logs', schema: 'HRM' })
@Unique(['userId', 'workDate'])
export class AttendanceLog {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'work_date', type: 'date' })
  workDate: string;

  @Column({ name: 'shift_id', nullable: true, type: 'bigint' })
  shiftId: number;

  @ManyToOne(() => Shift, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'shift_id' })
  shift: Shift;

  @Column({ name: 'check_in_at', nullable: true, type: 'timestamptz' })
  checkInAt: Date;

  @Column({ name: 'check_out_at', nullable: true, type: 'timestamptz' })
  checkOutAt: Date;

  @Column({ name: 'check_in_lat', nullable: true, type: 'decimal', precision: 9, scale: 6 })
  checkInLat: number;

  @Column({ name: 'check_in_lng', nullable: true, type: 'decimal', precision: 9, scale: 6 })
  checkInLng: number;

  @Column({ name: 'check_in_distance_m', nullable: true, type: 'int' })
  checkInDistanceM: number;

  @Column({ name: 'check_in_valid', nullable: true, type: 'boolean' })
  checkInValid: boolean;

  @Column({ name: 'check_out_lat', nullable: true, type: 'decimal', precision: 9, scale: 6 })
  checkOutLat: number;

  @Column({ name: 'check_out_lng', nullable: true, type: 'decimal', precision: 9, scale: 6 })
  checkOutLng: number;

  @Column({ name: 'check_out_distance_m', nullable: true, type: 'int' })
  checkOutDistanceM: number;

  @Column({ name: 'check_out_valid', nullable: true, type: 'boolean' })
  checkOutValid: boolean;

  @Column({
    type: 'enum',
    enum: AttendanceStatus,
    default: AttendanceStatus.PRESENT,
  })
  status: AttendanceStatus;

  @Column({ name: 'late_minutes', type: 'int', default: 0 })
  lateMinutes: number;

  @Column({ name: 'worked_minutes', type: 'int', default: 0 })
  workedMinutes: number;

  @Column({ name: 'is_adjusted', default: false })
  isAdjusted: boolean;

  @Column({ nullable: true, length: 255 })
  note: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
