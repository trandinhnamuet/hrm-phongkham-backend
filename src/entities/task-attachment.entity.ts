import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Task } from './task.entity';

@Entity({ name: 'task_attachments', schema: 'HRM' })
export class TaskAttachment {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'task_id', type: 'bigint' })
  taskId: number;

  @ManyToOne(() => Task, (t) => t.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @Column({ name: 'uploaded_by', type: 'uuid' })
  uploadedById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'uploaded_by' })
  uploadedBy: User;

  @Column({ name: 'file_name', length: 255 })
  fileName: string;

  @Column({ name: 'file_url', type: 'text' })
  fileUrl: string;

  @Column({ name: 'mime_type', nullable: true, length: 100 })
  mimeType: string;

  @Column({ name: 'size_bytes', nullable: true, type: 'bigint' })
  sizeBytes: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
