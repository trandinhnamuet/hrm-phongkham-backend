import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, OneToMany, JoinColumn,
  ManyToMany, JoinTable,
} from 'typeorm';
import { User } from './user.entity';
import { TaskComment } from './task-comment.entity';
import { TaskAttachment } from './task-attachment.entity';

export enum TaskPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

/** Kết quả đánh giá của người giao việc, chỉ có nghĩa khi status = DONE. */
export enum TaskReviewStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  ACCEPTED = 'ACCEPTED',
  RETURNED = 'RETURNED',
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
  QUA_HAN = 'QUA_HAN',
}

@Entity({ name: 'tasks', schema: 'HRM' })
export class Task {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ length: 255 })
  title: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ name: 'created_by', type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  /**
   * Một công việc có thể giao cho nhiều người.
   * Thay cho cột assignee_id cũ (xem migration TaskMultipleAssignees).
   */
  @ManyToMany(() => User, { eager: false, cascade: false })
  @JoinTable({
    name: 'task_assignees',
    schema: 'HRM',
    joinColumn: { name: 'task_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  })
  assignees: User[];

  @Column({ type: 'enum', enum: TaskPriority, default: TaskPriority.NORMAL })
  priority: TaskPriority;

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.TODO })
  status: TaskStatus;

  @Column({ name: 'due_date', nullable: true, type: 'date' })
  dueDate: Date;

  @Column({ name: 'completed_at', nullable: true, type: 'timestamptz' })
  completedAt: Date;

  @Column({ name: 'status_changed_at', nullable: true, type: 'timestamptz' })
  statusChangedAt: Date;

  /* ── Đánh giá của người giao việc ── */

  @Column({
    name: 'review_status', type: 'enum', enum: TaskReviewStatus, nullable: true,
  })
  reviewStatus: TaskReviewStatus | null;

  @Column({ name: 'review_note', nullable: true, type: 'text' })
  reviewNote: string | null;

  @Column({ name: 'reviewed_by', nullable: true, type: 'uuid' })
  reviewedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by' })
  reviewedBy: User | null;

  @Column({ name: 'reviewed_at', nullable: true, type: 'timestamptz' })
  reviewedAt: Date | null;

  @OneToMany(() => TaskComment, (c) => c.task)
  comments: TaskComment[];

  @OneToMany(() => TaskAttachment, (a) => a.task)
  attachments: TaskAttachment[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', nullable: true, type: 'timestamptz' })
  deletedAt: Date;
}
