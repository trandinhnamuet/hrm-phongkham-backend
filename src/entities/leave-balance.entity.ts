import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  Unique, UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { LeaveType } from './leave-type.entity';

@Entity({ name: 'leave_balances', schema: 'HRM' })
@Unique(['userId', 'year', 'month'])
export class LeaveBalance {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'smallint' })
  year: number;

  @Column({ type: 'smallint' })
  month: number;

  @Column({
    name: 'entitled_days',
    type: 'decimal',
    precision: 3,
    scale: 1,
    default: 4,
  })
  entitledDays: number;

  @Column({ name: 'used_days', type: 'decimal', precision: 3, scale: 1, default: 0 })
  usedDays: number;

  @Column({ name: 'pending_days', type: 'decimal', precision: 3, scale: 1, default: 0 })
  pendingDays: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
