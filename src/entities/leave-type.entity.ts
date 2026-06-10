import {
  Entity, PrimaryGeneratedColumn, Column,
} from 'typeorm';

export enum LeaveTypeCode {
  MONTHLY_OFF = 'MONTHLY_OFF',
  UNPAID = 'UNPAID',
  MARRIAGE = 'MARRIAGE',
  FUNERAL = 'FUNERAL',
  MILITARY = 'MILITARY',
}

@Entity({ name: 'leave_types', schema: 'HRM' })
export class LeaveType {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ unique: true, length: 30 })
  code: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'deducts_balance', default: true })
  deductsBalance: boolean;

  @Column({ name: 'max_days', nullable: true, type: 'smallint' })
  maxDays: number;

  @Column({ name: 'requires_doc', default: false })
  requiresDoc: boolean;

  @Column({ name: 'is_paid', default: true })
  isPaid: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
