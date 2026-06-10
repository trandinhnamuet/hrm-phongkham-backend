import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Task } from './task.entity';
import { User } from './user.entity';

@Entity({ name: 'task_histories', schema: 'HRM' })
export class TaskHistory {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'task_id', type: 'bigint' })
  taskId: number;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @Column({ name: 'changed_by_id', nullable: true, type: 'uuid' })
  changedById: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'changed_by_id' })
  changedBy: User;

  @Column({ name: 'change_type', length: 50 })
  changeType: string; // CREATED | STATUS_CHANGE | FIELD_UPDATE

  @Column({ name: 'field_name', nullable: true, length: 100 })
  fieldName: string;

  @Column({ name: 'old_value', nullable: true, type: 'text' })
  oldValue: string;

  @Column({ name: 'new_value', nullable: true, type: 'text' })
  newValue: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
