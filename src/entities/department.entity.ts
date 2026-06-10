import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'departments', schema: 'HRM' })
export class Department {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ length: 100, unique: true })
  name: string;

  @Column({ length: 50, unique: true })
  code: string;

  @Column({ nullable: true, length: 255 })
  description: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
