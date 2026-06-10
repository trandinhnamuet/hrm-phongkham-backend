import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Task } from './task.entity';

@Entity({ name: 'task_comments', schema: 'HRM' })
export class TaskComment {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'task_id', type: 'bigint' })
  taskId: number;

  @ManyToOne(() => Task, (t) => t.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', nullable: true, type: 'timestamptz' })
  deletedAt: Date;
}
