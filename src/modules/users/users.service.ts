import {
  Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import {
  IsArray, IsEmail, IsEnum, IsInt, IsOptional, IsString, MinLength, ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User, UserRole, UserStatus } from '../../entities/user.entity';
import { Department } from '../../entities/department.entity';
import { normalizeEmail, normalizePhone } from '../../common/utils/contact';

/** Chỉ kiểm định dạng email khi có nhập — để trống là hợp lệ (đăng nhập bằng SĐT). */
const hasEmail = (o: { email?: string | null }) => o.email !== undefined && o.email !== null && o.email !== '';

export class SetManagedDepartmentsDto {
  @ApiPropertyOptional({ type: [Number] })
  @IsOptional() @IsArray() @IsInt({ each: true }) @Type(() => Number)
  departmentIds?: number[];
}

export class CreateUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() employeeCode?: string;
  @ApiProperty() @IsString() fullName: string;
  @ApiPropertyOptional({ description: 'Email hoặc SĐT — cần ít nhất một để đăng nhập' })
  @ValidateIf(hasEmail) @IsEmail({}, { message: 'Email không hợp lệ' }) email?: string | null;
  @ApiProperty() @IsString() @MinLength(6) password: string;
  @ApiPropertyOptional({ description: 'Email hoặc SĐT — cần ít nhất một để đăng nhập' })
  @IsOptional() @IsString() phone?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @ApiPropertyOptional() @IsOptional() @IsString() positionTitle?: string;
  @ApiPropertyOptional() @IsOptional() joinDate?: string;
  @ApiPropertyOptional() @IsOptional() departmentId?: number;
  @ApiPropertyOptional({ description: 'Ca làm việc dùng để tính công' })
  @IsOptional() @Type(() => Number) @IsInt() shiftId?: number;
}

export class UpdateUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() fullName?: string;
  @ApiPropertyOptional({ description: 'null hoặc "" để xoá; phải còn email hoặc SĐT' })
  @ValidateIf(hasEmail) @IsEmail({}, { message: 'Email không hợp lệ' }) email?: string | null;
  @ApiPropertyOptional({ description: 'null hoặc "" để xoá; phải còn email hoặc SĐT' })
  @IsOptional() @IsString() phone?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @ApiPropertyOptional() @IsOptional() @IsString() positionTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() avatarUrl?: string;
  @ApiPropertyOptional() @IsOptional() departmentId?: number | null;
  @ApiPropertyOptional({ description: 'Ca làm việc dùng để tính công' })
  @IsOptional() shiftId?: number | null;
  @ApiPropertyOptional() @IsOptional() managedDepartmentIds?: number[];
}

export class ChangePasswordDto {
  @ApiProperty() @IsString() @MinLength(6) newPassword: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)       private repo:     Repository<User>,
    @InjectRepository(Department) private deptRepo: Repository<Department>,
  ) {}

  async findAll(role?: UserRole, status?: UserStatus) {
    const qb = this.repo.createQueryBuilder('u')
      .leftJoinAndSelect('u.department', 'dept')
      .leftJoinAndSelect('u.shift', 'shift')
      .leftJoinAndSelect('u.managedDepartments', 'managedDepts')
      .orderBy('u.fullName', 'ASC');
    if (role)   qb.andWhere('u.role = :role',     { role });
    if (status) qb.andWhere('u.status = :status', { status });
    return (await qb.getMany()).map(this.sanitize);
  }

  async findOne(id: string) {
    const user = await this.repo.findOne({
      where: { id },
      relations: { department: true, shift: true, managedDepartments: true },
    });
    if (!user) throw new NotFoundException('Không tìm thấy nhân viên');
    return this.sanitize(user);
  }

  async getManagedDepartments(userId: string) {
    const user = await this.repo.findOne({
      where: { id: userId },
      relations: { managedDepartments: true },
    });
    if (!user) throw new NotFoundException('Không tìm thấy nhân viên');
    return user.managedDepartments ?? [];
  }

  async setManagedDepartments(userId: string, deptIds: number[]) {
    const user = await this.repo.findOne({
      where: { id: userId },
      relations: { managedDepartments: true },
    });
    if (!user) throw new NotFoundException('Không tìm thấy nhân viên');
    if (user.role !== UserRole.QUAN_LY) {
      throw new BadRequestException('Chỉ có thể gắn bộ phận cho tài khoản có vai trò Quản lý');
    }
    user.managedDepartments = deptIds.length > 0
      ? await this.deptRepo.findBy({ id: In(deptIds) })
      : [];
    await this.repo.save(user);
    return user.managedDepartments;
  }

  private async generateEmployeeCode(): Promise<string> {
    const last = await this.repo
      .createQueryBuilder('u')
      .select('u.employeeCode', 'code')
      .where("u.employeeCode LIKE 'NV%'")
      .orderBy('u.employeeCode', 'DESC')
      .limit(1)
      .getRawOne();
    const nextNum = last ? (parseInt(last.code.replace('NV', ''), 10) || 0) + 1 : 1;
    return `NV${String(nextNum).padStart(3, '0')}`;
  }

  /**
   * Email và SĐT là tên đăng nhập: chuẩn hoá, bắt buộc có ít nhất một, và
   * không trùng với tài khoản khác (kể cả tài khoản đã nghỉ việc).
   */
  private async checkLoginContacts(email: string | null, phone: string | null, exceptId?: string) {
    if (!email && !phone) {
      throw new BadRequestException('Cần nhập ít nhất email hoặc số điện thoại để đăng nhập');
    }
    const others = exceptId ? { id: Not(exceptId) } : {};
    if (email && await this.repo.exists({ where: { email, ...others } })) {
      throw new ConflictException('Email đã được dùng cho nhân viên khác');
    }
    if (phone && await this.repo.exists({ where: { phone, ...others } })) {
      throw new ConflictException('Số điện thoại đã được dùng cho nhân viên khác');
    }
  }

  async create(dto: CreateUserDto) {
    const email = normalizeEmail(dto.email);
    const phone = normalizePhone(dto.phone);
    await this.checkLoginContacts(email, phone);

    const employeeCode = dto.employeeCode || await this.generateEmployeeCode();
    const codeExists = await this.repo.findOne({ where: { employeeCode } });
    if (codeExists) throw new ConflictException('Mã nhân viên đã tồn tại');

    const user = this.repo.create({
      employeeCode,
      fullName: dto.fullName,
      email,
      passwordHash: dto.password,
      phone,
      role: dto.role || UserRole.NHAN_VIEN,
      positionTitle: dto.positionTitle,
      joinDate: dto.joinDate ? new Date(dto.joinDate) : undefined,
      departmentId: dto.departmentId || undefined,
      shiftId: dto.shiftId || undefined,
    });
    return this.sanitize(await this.repo.save(user));
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.repo.findOne({
      where: { id },
      relations: { managedDepartments: true },
    });
    if (!user) throw new NotFoundException('Không tìm thấy nhân viên');

    const { managedDepartmentIds, email, phone, ...rest } = dto;
    // Bỏ field undefined (target ES2023 biến mọi field của DTO thành thuộc tính
    // thật), không thì gán đè làm mất giá trị cũ trong object trả về.
    Object.assign(user, Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)));

    if (email !== undefined || phone !== undefined) {
      if (email !== undefined) user.email = normalizeEmail(email);
      if (phone !== undefined) user.phone = normalizePhone(phone);
      await this.checkLoginContacts(user.email, user.phone, user.id);
    }

    if (managedDepartmentIds !== undefined) {
      if (user.role === UserRole.QUAN_LY || dto.role === UserRole.QUAN_LY) {
        user.managedDepartments = managedDepartmentIds.length > 0
          ? await this.deptRepo.findBy({ id: In(managedDepartmentIds) })
          : [];
      }
    }

    return this.sanitize(await this.repo.save(user));
  }

  async changePassword(id: string, newPassword: string, requesterId: string, requesterRole: UserRole) {
    if (id !== requesterId && requesterRole !== UserRole.GIAM_DOC) {
      throw new ForbiddenException('Không có quyền đổi mật khẩu người khác');
    }
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy nhân viên');
    user.passwordHash = newPassword;
    await this.repo.save(user);
    return { message: 'Đổi mật khẩu thành công' };
  }

  private sanitize(user: User) {
    const { passwordHash, ...rest } = user as any;
    return rest;
  }
}
