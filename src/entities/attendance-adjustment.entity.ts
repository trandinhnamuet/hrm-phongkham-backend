import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { AttendanceLog } from './attendance-log.entity';

export enum AdjustmentField {
  CHECK_IN = 'CHECK_IN',
  CHECK_OUT = 'CHECK_OUT',
  STATUS = 'STATUS',
}

export enum AdjustmentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity({ name: 'attendance_adjustments', schema: 'HRM' })
export class AttendanceAdjustment {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'log_id', type: 'bigint' })
  logId: number;

  @ManyToOne(() => AttendanceLog, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'log_id' })
  log: AttendanceLog;

  @Column({ name: 'requested_by', type: 'uuid' })
  requestedById: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requested_by' })
  requestedBy: User;

  @Column({ type: 'enum', enum: AdjustmentField })
  field: AdjustmentField;

  @Column({ name: 'requested_value', length: 50 })
  requestedValue: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({
    type: 'enum',
    enum: AdjustmentStatus,
    default: AdjustmentStatus.PENDING,
  })
  status: AdjustmentStatus;

  @Column({ name: 'reviewed_by', nullable: true, type: 'uuid' })
  reviewedById: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by' })
  reviewedBy: User;

  @Column({ name: 'reviewed_at', nullable: true, type: 'timestamptz' })
  reviewedAt: Date;

  @Column({ name: 'review_note', nullable: true, length: 255 })
  reviewNote: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
