import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { LeaveType } from './leave-type.entity';

export enum LeaveRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

@Entity({ name: 'leave_requests', schema: 'HRM' })
export class LeaveRequest {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'leave_type_id', type: 'bigint' })
  leaveTypeId: number;

  @ManyToOne(() => LeaveType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'leave_type_id' })
  leaveType: LeaveType;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ name: 'total_days', type: 'decimal', precision: 3, scale: 1 })
  totalDays: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({ name: 'attachment_url', nullable: true, type: 'text' })
  attachmentUrl: string;

  @Column({
    type: 'enum',
    enum: LeaveRequestStatus,
    default: LeaveRequestStatus.PENDING,
  })
  status: LeaveRequestStatus;

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

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', nullable: true, type: 'timestamptz' })
  deletedAt: Date;
}
