import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany, BeforeInsert, BeforeUpdate,
  ManyToOne, JoinColumn,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Department } from './department.entity';

export enum UserRole {
  GIAM_DOC = 'GIAM_DOC',
  QUAN_LY = 'QUAN_LY',
  NHAN_VIEN = 'NHAN_VIEN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  RESIGNED = 'RESIGNED',
}

@Entity({ name: 'users', schema: 'HRM' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, name: 'employee_code', length: 20 })
  employeeCode: string;

  @Column({ length: 150 })
  fullName: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ nullable: true, length: 20 })
  phone: string;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash: string;

  @Column({ name: 'avatar_url', nullable: true, type: 'text' })
  avatarUrl: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.NHAN_VIEN })
  role: UserRole;

  @Column({ name: 'position_title', nullable: true, length: 100 })
  positionTitle: string;

  @Column({ name: 'join_date', nullable: true, type: 'date' })
  joinDate: Date;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ name: 'department_id', nullable: true, type: 'bigint' })
  departmentId: number;

  @ManyToOne(() => Department, { nullable: true, onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ name: 'last_login_at', nullable: true, type: 'timestamptz' })
  lastLoginAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.passwordHash && !this.passwordHash.startsWith('$2b$')) {
      this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
    }
  }

  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.passwordHash);
  }
}
