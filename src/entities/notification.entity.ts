import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { User } from './user.entity';

export enum NotificationType {
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_COMMENT = 'TASK_COMMENT',
  TASK_REVIEWED = 'TASK_REVIEWED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  LEAVE_REVIEWED = 'LEAVE_REVIEWED',
}

/** Thông báo trong app cho từng người: đơn nghỉ được duyệt, việc có bình luận... */
@Entity({ name: 'notifications', schema: 'HRM' })
@Index(['userId', 'isRead', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  /** Người nhận. */
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  /** Nội dung chi tiết: câu bình luận, góp ý đánh giá, ghi chú duyệt đơn. */
  @Column({ type: 'text', nullable: true })
  body: string | null;

  /** Đường dẫn trong app để bấm vào là tới đúng chỗ. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  link: string | null;

  /** Người gây ra sự kiện, để hiện avatar / tên. */
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_id' })
  actor: User | null;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
