import {
  Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User, UserRole, UserStatus } from '../../entities/user.entity';
import { Department } from '../../entities/department.entity';

export class CreateUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() employeeCode?: string;
  @ApiProperty() @IsString() fullName: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() @MinLength(6) password: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @ApiPropertyOptional() @IsOptional() @IsString() positionTitle?: string;
  @ApiPropertyOptional() @IsOptional() joinDate?: string;
  @ApiPropertyOptional() @IsOptional() departmentId?: number;
}

export class UpdateUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() fullName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @ApiPropertyOptional() @IsOptional() @IsString() positionTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() avatarUrl?: string;
  @ApiPropertyOptional() @IsOptional() departmentId?: number | null;
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
      .leftJoinAndSelect('u.managedDepartments', 'managedDepts')
      .orderBy('u.fullName', 'ASC');
    if (role)   qb.andWhere('u.role = :role',     { role });
    if (status) qb.andWhere('u.status = :status', { status });
    return (await qb.getMany()).map(this.sanitize);
  }

  async findOne(id: string) {
    const user = await this.repo.findOne({
      where: { id },
      relations: { department: true, managedDepartments: true },
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

  async create(dto: CreateUserDto) {
    const emailExists = await this.repo.findOne({ where: { email: dto.email } });
    if (emailExists) throw new ConflictException('Email đã tồn tại');

    const employeeCode = dto.employeeCode || await this.generateEmployeeCode();
    const codeExists = await this.repo.findOne({ where: { employeeCode } });
    if (codeExists) throw new ConflictException('Mã nhân viên đã tồn tại');

    const user = this.repo.create({
      employeeCode,
      fullName: dto.fullName,
      email: dto.email,
      passwordHash: dto.password,
      phone: dto.phone,
      role: dto.role || UserRole.NHAN_VIEN,
      positionTitle: dto.positionTitle,
      joinDate: dto.joinDate ? new Date(dto.joinDate) : undefined,
      departmentId: dto.departmentId || undefined,
    });
    return this.sanitize(await this.repo.save(user));
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.repo.findOne({
      where: { id },
      relations: { managedDepartments: true },
    });
    if (!user) throw new NotFoundException('Không tìm thấy nhân viên');

    const { managedDepartmentIds, ...rest } = dto;
    Object.assign(user, rest);

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
